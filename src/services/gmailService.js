const env = require('../config/env');
const { google } = require('googleapis');
const { GmailIntegration } = require('../models');
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

function headerMap(headers = []) {
  return Object.fromEntries(headers.map((h) => [h.name, h.value]));
}

async function listMessages(userId, { maxResults = 10 } = {}) {
  const auth = await googleAuthService.getAuthorizedClientForUser(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const { data } = await gmail.users.messages.list({ userId: 'me', maxResults, q: 'in:inbox' });
  const messages = data.messages || [];

  return Promise.all(
    messages.map(async (m) => {
      const { data: msg } = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });
      const headers = headerMap(msg.payload?.headers);
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: headers.Subject || '(제목 없음)',
        from: headers.From || '',
        date: headers.Date || '',
        snippet: msg.snippet,
      };
    })
  );
}

async function getMessage(userId, messageId) {
  const auth = await googleAuthService.getAuthorizedClientForUser(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const { data } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const headers = headerMap(data.payload?.headers);
  const plainBody = extractPlainTextBody(data.payload);
  const htmlBody = extractHtmlBody(data.payload);

  return {
    id: data.id,
    threadId: data.threadId,
    subject: headers.Subject || '(제목 없음)',
    from: headers.From || '',
    date: headers.Date || '',
    body: plainBody || data.snippet || '',
    htmlBody: htmlBody || '',
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
};
