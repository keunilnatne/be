const { GmailIntegration, User } = require('../models');
const tokenEncryption = require('./tokenEncryptionService');

const REQUIRED_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

function decodeStoredToken(payload) {
  const raw = String(payload || '').trim();
  if (!raw) return null;

  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      return {
        accessToken: parsed.accessToken || null,
        refreshToken: parsed.refreshToken || parsed.accessToken || null,
        expiryDate: parsed.expiryDate || null,
        legacy: true,
      };
    } catch {
      return null;
    }
  }

  try {
    return {
      accessToken: null,
      refreshToken: tokenEncryption.decrypt(raw),
      expiryDate: null,
      legacy: !raw.startsWith('v1:'),
    };
  } catch {
    return null;
  }
}

/**
 * googleAccountStore.js
 * Google OAuth 토큰을 Railway MySQL의 gmail_integrations 테이블에 안전하게 저장/조회
 */

async function getByUserId(userId) {
  if (!userId || userId === 'guest') return null;
  const numId = Number(userId);
  if (!Number.isFinite(numId)) return null;

  const integration = await GmailIntegration.findOne({ where: { userId: numId } });
  if (!integration) return null;

  const tokenData = decodeStoredToken(integration.encryptedRefreshToken);
  if (!tokenData?.refreshToken) return null;

  if (tokenData.legacy) {
    try {
      await integration.update({
        encryptedRefreshToken: tokenEncryption.encrypt(tokenData.refreshToken),
        scopes: Array.isArray(integration.scopes) && integration.scopes.length
          ? integration.scopes
          : REQUIRED_SCOPES,
      });
    } catch (error) {
      console.warn('[GoogleAccountStore migration warning]:', error.message);
    }
  }

  return {
    userId: numId,
    googleEmail: integration.googleEmail,
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    expiryDate: tokenData.expiryDate || null,
  };
}

async function upsert(userId, account) {
  let numId = Number(userId);

  // userId가 없거나 guest인 경우 googleEmail로 유저 조회/생성
  if (!Number.isFinite(numId) || numId <= 0) {
    if (account.googleEmail) {
      const user = await User.findOne({ where: { email: account.googleEmail } });
      if (user) {
        numId = user.id;
      }
    }
  }

  if (Number.isFinite(numId) && numId > 0) {
    const existing = await GmailIntegration.findOne({ where: { userId: numId } });
    const existingToken = existing ? decodeStoredToken(existing.encryptedRefreshToken) : null;
    const refreshToken = account.refreshToken || existingToken?.refreshToken;
    if (!refreshToken) throw new Error('Google refresh token이 없습니다. 계정을 다시 연결해 주세요.');
    const tokenPayload = tokenEncryption.encrypt(refreshToken);
    const scopes = Array.isArray(account.scopes) && account.scopes.length
      ? account.scopes
      : (Array.isArray(existing?.scopes) && existing.scopes.length ? existing.scopes : REQUIRED_SCOPES);
    const googleEmail = account.googleEmail || existing?.googleEmail;

    if (existing) {
      await existing.update({
        googleEmail,
        encryptedRefreshToken: tokenPayload,
        scopes,
        connectedAt: new Date(),
      });
    } else {
      await GmailIntegration.create({
        userId: numId,
        googleEmail,
        encryptedRefreshToken: tokenPayload,
        scopes,
        connectedAt: new Date(),
      });
    }
  } else {
    throw new Error('Gmail 토큰을 연결할 사용자를 찾을 수 없습니다.');
  }

  return { ...account, userId: numId };
}

async function migrateLegacyTokens() {
  const integrations = await GmailIntegration.findAll();
  let migrated = 0;
  let skipped = 0;

  for (const integration of integrations) {
    if (String(integration.encryptedRefreshToken || '').startsWith('v1:')) continue;
    const tokenData = decodeStoredToken(integration.encryptedRefreshToken);
    if (!tokenData?.refreshToken) {
      skipped += 1;
      continue;
    }
    await integration.update({
      encryptedRefreshToken: tokenEncryption.encrypt(tokenData.refreshToken),
      scopes: Array.isArray(integration.scopes) && integration.scopes.length
        ? integration.scopes
        : REQUIRED_SCOPES,
    });
    migrated += 1;
  }

  return { migrated, skipped, total: integrations.length };
}

module.exports = {
  REQUIRED_SCOPES,
  decodeStoredToken,
  getByUserId,
  upsert,
  migrateLegacyTokens,
};
