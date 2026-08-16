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
  const [version, iv, tag, encrypted] = String(payload || '').split(':');
  if (version !== VERSION || !iv || !tag || !encrypted) {
    throw new Error('Invalid encrypted token format.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
