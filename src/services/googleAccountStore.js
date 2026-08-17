const { GmailIntegration, User } = require('../models');

/**
 * googleAccountStore.js
 * Google OAuth 토큰을 Railway MySQL의 gmail_integrations 테이블에 안전하게 저장/조회
 */

async function getByUserId(userId) {
  if (!userId || userId === 'guest') return null;
  const numId = Number(userId);
  if (!Number.isFinite(numId)) return null;

  try {
    const integration = await GmailIntegration.findOne({ where: { userId: numId } });
    if (!integration) return null;

    let tokenData = {};
    try {
      tokenData = JSON.parse(integration.encryptedRefreshToken);
    } catch {
      tokenData = { refreshToken: integration.encryptedRefreshToken };
    }

    return {
      userId: numId,
      googleEmail: integration.googleEmail,
      accessToken: tokenData.accessToken || null,
      refreshToken: tokenData.refreshToken || integration.encryptedRefreshToken,
      expiryDate: tokenData.expiryDate || null,
    };
  } catch (err) {
    console.error('[GoogleAccountStore getByUserId Error]:', err.message);
    return null;
  }
}

async function upsert(userId, account) {
  let numId = Number(userId);

  // userId가 없거나 guest인 경우 googleEmail로 유저 조회/생성
  if (!Number.isFinite(numId) || numId <= 0) {
    if (account.googleEmail) {
      try {
        let user = await User.findOne({ where: { email: account.googleEmail } });
        if (user) {
          numId = user.id;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (Number.isFinite(numId) && numId > 0) {
    try {
      const existing = await GmailIntegration.findOne({ where: { userId: numId } });
      const tokenPayload = JSON.stringify({
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        expiryDate: account.expiryDate,
      });

      if (existing) {
        await existing.update({
          googleEmail: account.googleEmail,
          encryptedRefreshToken: tokenPayload,
          connectedAt: new Date(),
        });
      } else {
        await GmailIntegration.create({
          userId: numId,
          googleEmail: account.googleEmail,
          encryptedRefreshToken: tokenPayload,
          connectedAt: new Date(),
        });
      }
    } catch (err) {
      console.error('[GoogleAccountStore upsert Error]:', err.message);
    }
  }

  return { ...account, userId: numId };
}

module.exports = { getByUserId, upsert };
