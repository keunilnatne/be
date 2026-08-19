const env = require('../config/env');
const { google } = require('googleapis');
const { Op } = require('sequelize');
const { GmailIntegration, InboxMail } = require('../models');
const googleAuthService = require('./googleAuthService');
const tokenEncryption = require('./tokenEncryptionService');
const ApiError = require('../utils/ApiError');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
}

function createRawMessage({ to, subject, body, attachments = [] }) {
  const normalizedBody = String(body || '').replace(/\r?\n/g, '\r\n');

  if (!attachments || attachments.length === 0) {
    const message = [
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(normalizedBody).toString('base64'),
    ].join('\r\n');
    return base64Url(message);
  }

  const boundary = `__boundary_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(normalizedBody).toString('base64'),
  ];

  for (const file of attachments) {
    const filename = file.name || file.filename || 'attachment';
    const contentType = file.type || file.contentType || 'application/octet-stream';
    let base64Data = file.data || file.content || '';
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }

    messageParts.push(
      '',
      `--${boundary}`,
      `Content-Type: ${contentType}; name="${encodeHeader(filename)}"`,
      `Content-Disposition: attachment; filename="${encodeHeader(filename)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      base64Data
    );
  }

  messageParts.push('', `--${boundary}--`, '');
  return base64Url(messageParts.join('\r\n'));
}

function extractPlainTextBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }
  return '';
}

function extractHtmlBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }
  return '';
}

function extractAttachments(payload, messageId) {
  const attachments = [];

  function traverse(part) {
    if (!part) return;
    if (part.filename && part.filename.trim().length > 0) {
      const size = part.body?.size || 0;
      const attachmentId = part.body?.attachmentId || null;
      attachments.push({
        id: attachmentId || `${messageId}-${part.partId || attachments.length}`,
        name: part.filename,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: size,
        attachmentId: attachmentId,
        messageId: messageId,
      });
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(payload);
  return attachments;
}

async function getAttachment(userId, messageId, attachmentId) {
  const auth = await googleAuthService.getAuthorizedClientForUser(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const { data } = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  return {
    size: data.size,
    data: data.data, // base64url encoded
  };
}

function headerMap(headers = []) {
  return Object.fromEntries(headers.map((h) => [h.name, h.value]));
}

function parseSender(fromStr = '') {
  if (!fromStr) return { name: '알 수 없음', email: '' };
  const match = fromStr.match(/(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)/);
  if (match) {
    const name = match[1]?.trim() || match[2]?.split('@')[0] || fromStr;
    const email = match[2]?.trim() || '';
    return { name, email };
  }
  return { name: fromStr.split('@')[0] || fromStr, email: fromStr.includes('@') ? fromStr : '' };
}

async function listMessages(userId, { maxResults = 50, q } = {}) {
  // 1. Gmail API에서 새로운 메일 조회 및 DB에 추가 (누적 저장)
  try {
    const auth = await googleAuthService.getAuthorizedClientForUser(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const queryStr = q ? `in:inbox ${q}` : 'in:inbox';
    const { data } = await gmail.users.messages.list({ userId: 'me', maxResults, q: queryStr });
    const messages = data.messages || [];

    if (messages.length > 0) {
      // 이미 DB에 존재하는 메일 ID 조회
      const existingMails = await InboxMail.findAll({
        where: {
          userId,
          gmailMessageId: messages.map((m) => m.id),
        },
        attributes: ['gmailMessageId'],
      });
      const existingIds = new Set(existingMails.map((m) => m.gmailMessageId));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));

      // 신규 메일 상세 정보 병렬 조회 후 DB에 축적 저장 (10개씩 청크)
      for (let i = 0; i < newMessages.length; i += 10) {
        const chunk = newMessages.slice(i, i + 10);
        await Promise.all(
          chunk.map(async (m) => {
            try {
              const { data: msg } = await gmail.users.messages.get({
                userId: 'me',
                id: m.id,
                format: 'full',
              });
              const headers = headerMap(msg.payload?.headers);
              const plainBody = extractPlainTextBody(msg.payload);
              const htmlBody = extractHtmlBody(msg.payload);
              const attachments = extractAttachments(msg.payload, msg.id);
              const sender = parseSender(headers.From || '');

              let internalDate = Number(msg.internalDate);
              if (!internalDate && headers.Date) {
                internalDate = new Date(headers.Date).getTime();
              }

              await InboxMail.upsert({
                userId,
                gmailMessageId: msg.id,
                threadId: msg.threadId,
                subject: headers.Subject || '(제목 없음)',
                from: headers.From || '',
                fromName: sender.name,
                fromEmail: sender.email,
                date: headers.Date || '',
                internalDate: internalDate || Date.now(),
                snippet: msg.snippet || '',
                body: plainBody || msg.snippet || '',
                htmlBody: htmlBody || '',
                attachments: attachments || [],
              });
            } catch (err) {
              console.error(`[GmailSync] Error storing message ${m.id}:`, err.message);
            }
          })
        );
      }
    }
  } catch (syncError) {
    console.warn(`[GmailSync] Gmail fetch warning for user ${userId}:`, syncError.message);
    const count = await InboxMail.count({ where: { userId } });
    if (count === 0 && (syncError.code === 'GMAIL_NOT_CONNECTED' || syncError.message?.includes('연결된 Gmail 계정이 없습니다'))) {
      throw syncError;
    }
  }

  // 2. DB에 계속 축적된 전체 메일 목록 반환 (최신순)
  const where = { userId };
  if (q) {
    where[Op.or] = [
      { subject: { [Op.like]: `%${q}%` } },
      { from: { [Op.like]: `%${q}%` } },
      { fromName: { [Op.like]: `%${q}%` } },
      { fromEmail: { [Op.like]: `%${q}%` } },
      { snippet: { [Op.like]: `%${q}%` } },
      { body: { [Op.like]: `%${q}%` } },
    ];
  }

  const storedMails = await InboxMail.findAll({
    where,
    order: [
      ['internalDate', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  return storedMails.map((m) => ({
    id: m.gmailMessageId,
    threadId: m.threadId,
    subject: m.subject || '(제목 없음)',
    from: m.from || '',
    fromName: m.fromName || '',
    fromEmail: m.fromEmail || '',
    date: m.date || '',
    snippet: m.snippet || '',
    body: m.body || '',
    htmlBody: m.htmlBody || '',
    attachments: m.attachments || [],
  }));
}

async function getMessage(userId, messageId) {
  // 1. DB에 이미 캐싱되어 본문이 있는 경우 즉시 반환
  const stored = await InboxMail.findOne({ where: { userId, gmailMessageId: messageId } });
  if (stored && stored.body) {
    return {
      id: stored.gmailMessageId,
      threadId: stored.threadId,
      subject: stored.subject || '(제목 없음)',
      from: stored.from || '',
      fromName: stored.fromName || '',
      fromEmail: stored.fromEmail || '',
      date: stored.date || '',
      body: stored.body,
      htmlBody: stored.htmlBody || '',
      attachments: stored.attachments || [],
    };
  }

  // 2. DB에 없거나 본문이 비어있으면 Gmail API에서 full 상세 조회 후 DB 저장
  const auth = await googleAuthService.getAuthorizedClientForUser(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const { data } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const headers = headerMap(data.payload?.headers);
  const plainBody = extractPlainTextBody(data.payload);
  const htmlBody = extractHtmlBody(data.payload);
  const attachments = extractAttachments(data.payload, data.id);
  const sender = parseSender(headers.From || '');

  let internalDate = Number(data.internalDate);
  if (!internalDate && headers.Date) {
    internalDate = new Date(headers.Date).getTime();
  }

  await InboxMail.upsert({
    userId,
    gmailMessageId: data.id,
    threadId: data.threadId,
    subject: headers.Subject || '(제목 없음)',
    from: headers.From || '',
    fromName: sender.name,
    fromEmail: sender.email,
    date: headers.Date || '',
    internalDate: internalDate || Date.now(),
    snippet: data.snippet || '',
    body: plainBody || data.snippet || '',
    htmlBody: htmlBody || '',
    attachments: attachments || [],
  });

  return {
    id: data.id,
    threadId: data.threadId,
    subject: headers.Subject || '(제목 없음)',
    from: headers.From || '',
    fromName: sender.name,
    fromEmail: sender.email,
    date: headers.Date || '',
    body: plainBody || data.snippet || '',
    htmlBody: htmlBody || '',
    attachments,
  };
}

async function getAccessToken(userId) {
  const integration = await GmailIntegration.findOne({ where: { userId } });
  if (!integration) {
    throw ApiError.gmailNotConnected();
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      refresh_token: tokenEncryption.decrypt(integration.encryptedRefreshToken),
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw ApiError.gmailNotConnected({ reason: 'TOKEN_REFRESH_FAILED' });
  }
  return payload.access_token;
}

// Polymorphic sendMessage supporting both sendMessage(userId, {to, subject, body, attachments}) and sendMessage({accessToken, to, subject, body, attachments})
async function sendMessage(arg1, arg2) {
  if (typeof arg1 === 'object' && arg1.accessToken) {
    const { accessToken, to, subject, body, attachments } = arg1;
    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: createRawMessage({ to, subject, body, attachments }) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw ApiError.gmailSendFailed({
        reason: 'GMAIL_API_REJECTED',
        providerStatus: response.status,
      });
    }
    if (!payload.id) throw ApiError.gmailSendFailed({ reason: 'MISSING_GMAIL_MESSAGE_ID' });
    return payload;
  }

  const userId = arg1;
  const { to, subject, body, attachments } = arg2 || {};
  try {
    const auth = await googleAuthService.getAuthorizedClientForUser(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = createRawMessage({ to, subject, body, attachments });
    const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    if (!data?.id) throw ApiError.gmailSendFailed({ reason: 'MISSING_GMAIL_MESSAGE_ID' });
    return data;
  } catch (error) {
    if (error.code === 'GMAIL_NOT_CONNECTED' || error.code === 'GMAIL_SEND_FAILED') throw error;
    if (error.statusCode === 404) throw ApiError.gmailNotConnected();
    throw ApiError.gmailSendFailed({ reason: 'GMAIL_API_FAILED' });
  }
}

module.exports = {
  createRawMessage,
  getAccessToken,
  sendMessage,
  listMessages,
  getMessage,
  getAttachment,
};
