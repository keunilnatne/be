const assert = require('node:assert/strict');
const { sequelize, GmailIntegration } = require('../models');
const tokenEncryption = require('../services/tokenEncryptionService');

async function verify() {
  await sequelize.authenticate();
  await GmailIntegration.sync();

  const [columns] = await sequelize.query('SHOW COLUMNS FROM gmail_integrations');
  const names = columns.map((column) => column.Field);
  for (const required of [
    'id',
    'user_id',
    'google_email',
    'encrypted_refresh_token',
    'scopes',
    'connected_at',
  ]) {
    assert.ok(names.includes(required), `Missing column: ${required}`);
  }

  const encrypted = tokenEncryption.encrypt('qa-refresh-token');
  assert.equal(tokenEncryption.decrypt(encrypted), 'qa-refresh-token');
  assert.equal(encrypted.includes('qa-refresh-token'), false);

  console.log('[통과] Gmail 연동 테이블 및 필수 컬럼 확인');
  console.log('[통과] Refresh Token 암호화/복호화 및 평문 비노출 확인');
  console.log('[안내] 실제 Google OAuth 승인은 브라우저 QA에서 별도로 확인해야 합니다.');
}

verify()
  .then(async () => sequelize.close())
  .catch(async (error) => {
    console.error('[검증 실패]', error.message);
    await sequelize.close();
    process.exit(1);
  });
