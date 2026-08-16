const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { sequelize, GmailIntegration } = require('../models');
const tokenEncryption = require('./tokenEncryptionService');
const ApiError = require('../utils/ApiError');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'];

function requireConfig() {
  const missing = [
    ['GOOGLE_CLIENT_ID', env.google.clientId],
    ['GOOGLE_CLIENT_SECRET', env.google.clientSecret],
    ['GOOGLE_REDIRECT_URI', env.google.redirectUri],
    ['TOKEN_ENCRYPTION_KEY', env.google.tokenEncryptionKey],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing Gmail OAuth configuration: ${missing.join(', ')}`);
}

function createState(userId) {
  return jwt.sign(
    { sub: String(userId), purpose: 'gmail-oauth' },
    env.jwt.secret,
    { expiresIn: '10m', jwtid: require('crypto').randomUUID() }
  );
}

function verifyState(state) {
  try {
    const payload = jwt.verify(state, env.jwt.secret);
    if (payload.purpose !== 'gmail-oauth') throw new Error('wrong purpose');
    return Number(payload.sub);
  } catch (_error) {
    throw ApiError.badRequest('유효하지 않거나 만료된 Gmail 연결 요청입니다.');
  }
}

function getAuthorizationUrl(userId) {
  requireConfig();
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state: createState(userId),
  });
  return `${AUTH_URL}?${params}`;
}

async function googleRequest(url, options, errorMessage) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw ApiError.badRequest(errorMessage, body);
  return body;
}

async function exchangeCode(code) {
  return googleRequest(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: env.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  }, 'Google 인증 코드를 토큰으로 교환하지 못했습니다.');
}

async function getGoogleEmail(accessToken) {
  const info = await googleRequest(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  }, 'Google 계정 정보를 조회하지 못했습니다.');
  if (!info.email) throw ApiError.badRequest('Google 계정 이메일을 확인하지 못했습니다.');
  return info.email;
}

async function updateUserFlags(userId, connected, email, transaction) {
  await sequelize.query(
    'UPDATE users SET google_connected = ?, google_email = ? WHERE id = ?',
    { replacements: [connected, email, userId], transaction }
  );
}

async function connect({ state, code }) {
  requireConfig();
  if (!code) throw ApiError.badRequest('Google 인증 코드가 없습니다.');
  const userId = verifyState(state);
  const tokens = await exchangeCode(code);
  const googleEmail = await getGoogleEmail(tokens.access_token);
  const existing = await GmailIntegration.findOne({ where: { userId } });
  const refreshToken = tokens.refresh_token || (existing && tokenEncryption.decrypt(existing.encryptedRefreshToken));
  if (!refreshToken) {
    throw ApiError.badRequest('Refresh Token을 받지 못했습니다. Google 권한을 해제한 뒤 다시 연결해 주세요.');
  }

  return sequelize.transaction(async (transaction) => {
    const [integration] = await GmailIntegration.upsert({
      userId,
      googleEmail,
      encryptedRefreshToken: tokenEncryption.encrypt(refreshToken),
      scopes: String(tokens.scope || '').split(' ').filter(Boolean),
      connectedAt: new Date(),
    }, { transaction, returning: true });
    await updateUserFlags(userId, true, googleEmail, transaction);
    return integration;
  });
}

async function status(userId) {
  const integration = await GmailIntegration.findOne({ where: { userId } });
  return integration ? {
    connected: true,
    email: integration.googleEmail,
    scopes: integration.scopes,
    connectedAt: integration.connectedAt,
  } : { connected: false, email: null, scopes: [], connectedAt: null };
}

async function disconnect(userId) {
  const integration = await GmailIntegration.findOne({ where: { userId } });
  if (!integration) return false;
  const refreshToken = tokenEncryption.decrypt(integration.encryptedRefreshToken);
  const response = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  });
  if (!response.ok && response.status !== 400) {
    throw ApiError.badRequest('Google 권한 해제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  await sequelize.transaction(async (transaction) => {
    await integration.destroy({ transaction });
    await updateUserFlags(userId, false, null, transaction);
  });
  return true;
}

module.exports = {
  getAuthorizationUrl,
  verifyState,
  connect,
  status,
  disconnect,
  SCOPES,
};
