const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const googleAccountStore = require('./googleAccountStore');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function assertConfigured() {
  if (!env.google.clientId || !env.google.clientSecret || !env.google.redirectUri) {
    const err = new Error(
      'Google OAuth 자격증명이 설정되지 않았습니다. .env의 GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI를 채워주세요.'
    );
    err.statusCode = 501;
    throw err;
  }
}

function createOAuth2Client() {
  assertConfigured();
  return new google.auth.OAuth2(env.google.clientId, env.google.clientSecret, env.google.redirectUri);
}

// 사용자를 Google 동의 화면으로 보낼 URL 생성. state에 userId를 실어서 콜백에서 매칭.
function createLoginState() {
  return jwt.sign(
    { purpose: 'google-login' },
    env.jwt.secret,
    { expiresIn: '10m', jwtid: crypto.randomUUID() }
  );
}

function verifyLoginState(state) {
  try {
    const payload = jwt.verify(state, env.jwt.secret);
    if (payload.purpose !== 'google-login') throw new Error('wrong purpose');
    return payload;
  } catch {
    const error = new Error('유효하지 않거나 만료된 Google 로그인 요청입니다.');
    error.statusCode = 400;
    throw error;
  }
}

function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: createLoginState(),
  });
}

// 콜백에서 받은 code를 토큰으로 교환하고 Google 계정 정보를 반환한다.
// 계정 생성과 암호화 저장은 컨트롤러에서 사용자 ID를 확정한 뒤 수행한다.
async function handleCallback(code, state) {
  verifyLoginState(state);
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  return {
    googleEmail: profile.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiryDate: tokens.expiry_date || null,
    scopes: tokens.scope ? String(tokens.scope).split(' ').filter(Boolean) : SCOPES,
  };
}

// 저장된 토큰으로 인증된 OAuth2 클라이언트 생성. 토큰이 갱신되면 DB에 다시 기록.
async function getAuthorizedClientForUser(userId) {
  const account = await googleAccountStore.getByUserId(userId);
  if (!account) {
    const err = new Error('연결된 Gmail 계정이 없습니다. 먼저 Google 계정을 연결하세요.');
    err.statusCode = 404;
    throw err;
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiryDate || undefined,
  });

  client.on('tokens', (tokens) => {
    void googleAccountStore.upsert(userId, {
      googleEmail: account.googleEmail,
      accessToken: tokens.access_token || account.accessToken,
      refreshToken: tokens.refresh_token || account.refreshToken,
      expiryDate: tokens.expiry_date || account.expiryDate,
    }).catch((error) => {
      console.error('[Google token refresh persistence error]:', error.message);
    });
  });

  return client;
}

async function getStatus(userId) {
  const account = await googleAccountStore.getByUserId(userId);
  return { connected: Boolean(account), email: account?.googleEmail || null };
}

module.exports = {
  SCOPES,
  createLoginState,
  verifyLoginState,
  getAuthUrl,
  handleCallback,
  getAuthorizedClientForUser,
  getStatus,
};
