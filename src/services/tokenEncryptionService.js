const crypto = require('crypto');
const env = require('../config/env');

const VERSION = 'v1';

function key() {
  const secret = env.google.tokenEncryptionKey;
  if (!secret || secret.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must contain at least 32 characters.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value) {
  if (!value) throw new Error('Cannot encrypt an empty token.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, encrypted].map((part) =>
    Buffer.isBuffer(part) ? part.toString('base64url') : part
  ).join(':');
}

function decrypt(payload) {
  if (!payload) throw new Error('Invalid encrypted token format.');
  const raw = String(payload).trim();

  // 1. JSON 포맷인 경우 (accessToken, refreshToken 포함)
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.refreshToken) return parsed.refreshToken;
      if (parsed.accessToken) return parsed.accessToken;
    } catch {
      // continue
    }
  }

  // 2. AES-256-GCM 암호화 포맷인 경우 (v1:iv:tag:encrypted)
  const [version, iv, tag, encrypted] = raw.split(':');
  if (version === VERSION && iv && tag && encrypted) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  // 3. 이미 평문 토큰인 경우 (1//... 또는 ya29...)
  if (raw.startsWith('1//') || raw.startsWith('ya29.')) {
    return raw;
  }

  throw new Error('Invalid encrypted token format.');
}

module.exports = { encrypt, decrypt };
