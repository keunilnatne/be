const { google } = require('googleapis');
const googleAuthService = require('./googleAuthService');

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

  return {
    id: data.id,
    threadId: data.threadId,
    subject: headers.Subject || '(제목 없음)',
    from: headers.From || '',
    date: headers.Date || '',
    body: extractPlainTextBody(data.payload) || data.snippet || '',
  };
}

function buildRawMessage({ to, subject, body }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  const message = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${encodedSubject}`,
    '',
    body,
  ].join('\n');

  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendMessage(userId, { to, subject, body }) {
  const auth = await googleAuthService.getAuthorizedClientForUser(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = buildRawMessage({ to, subject, body });
  const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return data;
}

module.exports = { listMessages, getMessage, sendMessage };
