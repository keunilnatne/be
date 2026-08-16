const env = require('../config/env');
const { GmailIntegration } = require('../models');
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

function createRawMessage({ to, subject, body }) {
  const normalizedBody = String(body).replace(/\r?\n/g, '\r\n');
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

async function parseResponse(response) {
  return response.json().catch(() => ({}));
}

async function getAccessToken(userId) {
  const integration = await GmailIntegration.findOne({ where: { userId } });
  if (!integration) {
    throw ApiError.badRequest('Gmail 계정이 연결되어 있지 않습니다.');
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
  const payload = await parseResponse(response);
  if (!response.ok || !payload.access_token) {
    throw ApiError.badRequest('Gmail 인증이 만료되었습니다. 계정을 다시 연결해 주세요.', payload);
  }
  return payload.access_token;
}

async function sendMessage({ accessToken, to, subject, body }) {
  const response = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ raw: createRawMessage({ to, subject, body }) }),
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Gmail 발송에 실패했습니다.');
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

module.exports = { createRawMessage, getAccessToken, sendMessage };
