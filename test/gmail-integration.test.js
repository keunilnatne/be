const test = require('node:test');
const assert = require('node:assert/strict');

const env = require('../src/config/env');
const tokenEncryption = require('../src/services/tokenEncryptionService');
const gmailOAuthService = require('../src/services/gmailOAuthService');
const googleAccountStore = require('../src/services/googleAccountStore');
const controller = require('../src/controllers/gmailIntegration.controller');

test.before(() => {
  env.google.clientId = 'test-client-id';
  env.google.clientSecret = 'test-client-secret';
  env.google.redirectUri = 'http://localhost:4000/api/integrations/gmail/callback';
  env.google.tokenEncryptionKey = '01234567890123456789012345678901';
  env.google.frontendOrigin = 'http://localhost:5173';
});

test('refresh token encryption round-trip does not expose plaintext', () => {
  const encrypted = tokenEncryption.encrypt('refresh-token-value');
  assert.ok(encrypted.startsWith('v1:'));
  assert.equal(encrypted.includes('refresh-token-value'), false);
  assert.equal(tokenEncryption.decrypt(encrypted), 'refresh-token-value');
});

test('encrypted token rejects tampering', () => {
  const encrypted = tokenEncryption.encrypt('refresh-token-value');
  assert.throws(() => tokenEncryption.decrypt(`${encrypted}broken`));
});

test('legacy Gmail token rows are migrated without exposing plaintext', async () => {
  const { GmailIntegration } = require('../src/models');
  const originalFindAll = GmailIntegration.findAll;
  let updatedValues;
  GmailIntegration.findAll = async () => [{
    encryptedRefreshToken: JSON.stringify({
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh',
      expiryDate: 123,
    }),
    scopes: [],
    async update(values) { updatedValues = values; },
  }];

  try {
    const result = await googleAccountStore.migrateLegacyTokens();
    assert.deepEqual(result, { migrated: 1, skipped: 0, total: 1 });
    assert.ok(updatedValues.encryptedRefreshToken.startsWith('v1:'));
    assert.equal(updatedValues.encryptedRefreshToken.includes('legacy-refresh'), false);
    assert.equal(tokenEncryption.decrypt(updatedValues.encryptedRefreshToken), 'legacy-refresh');
    assert.ok(updatedValues.scopes.includes('https://www.googleapis.com/auth/gmail.readonly'));
  } finally {
    GmailIntegration.findAll = originalFindAll;
  }
});

test('token refresh preserves the existing Gmail identity and refresh token', async () => {
  const { GmailIntegration } = require('../src/models');
  const originalFindOne = GmailIntegration.findOne;
  const existing = {
    googleEmail: 'owner@example.com',
    encryptedRefreshToken: tokenEncryption.encrypt('stable-refresh-token'),
    scopes: gmailOAuthService.SCOPES,
    async update(values) { Object.assign(this, values); },
  };
  GmailIntegration.findOne = async () => existing;

  try {
    await googleAccountStore.upsert(17, { accessToken: 'rotated-access-token' });
    assert.equal(existing.googleEmail, 'owner@example.com');
    assert.equal(tokenEncryption.decrypt(existing.encryptedRefreshToken), 'stable-refresh-token');
    assert.equal(existing.encryptedRefreshToken.includes('stable-refresh-token'), false);
  } finally {
    GmailIntegration.findOne = originalFindOne;
  }
});

test('authorization URL has offline Gmail send scope and signed state', () => {
  const url = new URL(gmailOAuthService.getAuthorizationUrl(17));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.match(url.searchParams.get('scope'), /gmail\.send/);
  assert.equal(gmailOAuthService.verifyState(url.searchParams.get('state')), 17);
});

test('invalid OAuth state is rejected', () => {
  assert.throws(() => gmailOAuthService.verifyState('invalid'), /유효하지 않거나 만료된/);
});

test('callback HTML restricts postMessage to configured frontend origin', () => {
  const html = controller.callbackHtml({ type: 'gmail-auth-success', email: 'user@example.com' });
  assert.match(html, /http:\/\/localhost:5173/);
  assert.doesNotMatch(html, /postMessage\([^)]*, ['"]\*['"]\)/);
});

test('Gmail status returns a disconnected shape when no token exists', async () => {
  const { GmailIntegration } = require('../src/models');
  const original = GmailIntegration.findOne;
  GmailIntegration.findOne = async () => null;
  try {
    assert.deepEqual(await gmailOAuthService.status(1), {
      connected: false,
      email: null,
      scopes: [],
      connectedAt: null,
    });
  } finally {
    GmailIntegration.findOne = original;
  }
});

test('OAuth callback exchanges code and stores only an encrypted refresh token', async () => {
  const { sequelize, GmailIntegration } = require('../src/models');
  const originals = {
    fetch: global.fetch,
    findOne: GmailIntegration.findOne,
    upsert: GmailIntegration.upsert,
    transaction: sequelize.transaction,
    query: sequelize.query,
  };
  let saved;
  global.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes('token')
      ? { access_token: 'access-value', refresh_token: 'refresh-value', scope: gmailOAuthService.SCOPES.join(' ') }
      : { email: 'qa@example.com' },
  });
  GmailIntegration.findOne = async () => null;
  GmailIntegration.upsert = async (values) => {
    saved = values;
    return [{ ...values }];
  };
  sequelize.transaction = async (work) => work({ id: 'transaction' });
  sequelize.query = async () => [];

  try {
    const url = new URL(gmailOAuthService.getAuthorizationUrl(17));
    const result = await gmailOAuthService.connect({
      state: url.searchParams.get('state'),
      code: 'authorization-code',
    });
    assert.equal(result.googleEmail, 'qa@example.com');
    assert.equal(saved.encryptedRefreshToken.includes('refresh-value'), false);
    assert.equal(tokenEncryption.decrypt(saved.encryptedRefreshToken), 'refresh-value');
  } finally {
    global.fetch = originals.fetch;
    GmailIntegration.findOne = originals.findOne;
    GmailIntegration.upsert = originals.upsert;
    sequelize.transaction = originals.transaction;
    sequelize.query = originals.query;
  }
});

test('disconnect revokes Google permission and deletes the stored token', async () => {
  const { sequelize, GmailIntegration } = require('../src/models');
  const originals = {
    fetch: global.fetch,
    findOne: GmailIntegration.findOne,
    transaction: sequelize.transaction,
    query: sequelize.query,
  };
  let destroyed = false;
  let revokedToken;
  global.fetch = async (_url, options) => {
    revokedToken = new URLSearchParams(options.body).get('token');
    return { ok: true, status: 200 };
  };
  GmailIntegration.findOne = async () => ({
    encryptedRefreshToken: tokenEncryption.encrypt('refresh-to-revoke'),
    destroy: async () => { destroyed = true; },
  });
  sequelize.transaction = async (work) => work({ id: 'transaction' });
  sequelize.query = async () => [];

  try {
    assert.equal(await gmailOAuthService.disconnect(17), true);
    assert.equal(revokedToken, 'refresh-to-revoke');
    assert.equal(destroyed, true);
  } finally {
    global.fetch = originals.fetch;
    GmailIntegration.findOne = originals.findOne;
    sequelize.transaction = originals.transaction;
    sequelize.query = originals.query;
  }
});
