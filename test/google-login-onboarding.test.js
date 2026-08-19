const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../src/models');
const authController = require('../src/controllers/auth.controller');
const googleAuthService = require('../src/services/googleAuthService');
const googleAccountStore = require('../src/services/googleAccountStore');
const tokenEncryption = require('../src/services/tokenEncryptionService');

test('new Google login tells the frontend to restart onboarding', async () => {
  const originals = {
    handleCallback: googleAuthService.handleCallback,
    userFindOne: models.User.findOne,
    userCreate: models.User.create,
    userSettingCreate: models.UserSetting.create,
    accountUpsert: googleAccountStore.upsert,
    integrationFindOne: models.GmailIntegration.findOne,
    integrationCreate: models.GmailIntegration.create,
    encrypt: tokenEncryption.encrypt,
  };

  googleAuthService.handleCallback = async () => ({
    googleEmail: 'new-user@example.com',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiryDate: Date.now() + 60_000,
  });
  models.User.findOne = async () => null;
  models.User.create = async (values) => ({ id: 77, ...values });
  models.UserSetting.create = async () => ({ userId: 77 });
  googleAccountStore.upsert = async () => ({});
  models.GmailIntegration.findOne = async () => null;
  models.GmailIntegration.create = async () => ({});
  tokenEncryption.encrypt = () => 'encrypted-token';

  let html = '';
  const res = {
    type() { return this; },
    send(value) { html = value; return this; },
  };

  try {
    await authController.googleCallback({ query: { code: 'oauth-code' } }, res);
    assert.match(html, /type: 'google-auth-success'/);
    assert.match(html, /isNewUser: true/);
    assert.match(html, /welcome\?newAccount=true/);
  } finally {
    googleAuthService.handleCallback = originals.handleCallback;
    models.User.findOne = originals.userFindOne;
    models.User.create = originals.userCreate;
    models.UserSetting.create = originals.userSettingCreate;
    googleAccountStore.upsert = originals.accountUpsert;
    models.GmailIntegration.findOne = originals.integrationFindOne;
    models.GmailIntegration.create = originals.integrationCreate;
    tokenEncryption.encrypt = originals.encrypt;
  }
});
