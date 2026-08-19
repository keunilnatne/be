const test = require('node:test');
const assert = require('node:assert/strict');

const { User, Company, UserSetting, Notice, Recipient } = require('../src/models');
const tagService = require('../src/services/tagService');
const aiService = require('../src/services/aiService');

let storedUser = null;

function installModelFakes() {
  User.findOne = async ({ where }) => (
    storedUser?.email === where.email ? storedUser : null
  );
  User.findByPk = async (id) => (
    storedUser && String(storedUser.id) === String(id) ? storedUser : null
  );
  User.create = async (values) => {
    storedUser = {
      id: 1,
      ...values,
      Company: null,
      async update(updates) {
        Object.assign(this, updates);
        return this;
      },
      async save() {
        return this;
      },
      get() {
        return { ...this };
      },
    };
    return storedUser;
  };
  Company.findByPk = async () => null;
  UserSetting.findOrCreate = async () => [{ userId: 1 }, true];
  UserSetting.findOne = async () => ({
    userId: 1,
    tone: 'professional',
    formality: 'formal',
    length: 'medium',
    aiAutoSuggestion: true,
    dataRetentionDays: 30,
  });
  Notice.findAll = async () => [];
  Notice.create = async (values) => ({
    id: 1,
    ...values,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  Recipient.findOne = async ({ where }) => (
    Number(where.id) === 7 && Number(where.ownerUserId) === 1
      ? {
        id: 7,
        ownerUserId: 1,
        name: 'Alex',
        language: 'English',
        get() { return { ...this }; },
      }
      : null
  );
  aiService.analyzeRecipientProfile = async () => ({
    tags: ['concise'],
    terms: ['deadline'],
    rules: ['state the deadline'],
  });
  aiService.analyzeMessageMetadata = async () => ({
    priority: 'NORMAL',
    tags: ['request'],
    terms: ['deadline'],
    rules: ['be concise'],
    sourceLanguage: 'Korean',
    targetLanguage: 'English',
  });
  tagService.getTagsForEntity = async () => [];
  tagService.setTagsForEntity = async () => [];
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body && { 'content-type': 'application/json' }),
      ...options.headers,
    },
  });
  const responseText = await response.text();
  let body = responseText;
  try {
    body = JSON.parse(responseText);
  } catch {
    // Express의 404 HTML 응답도 상태 코드를 검증할 수 있게 그대로 둔다.
  }
  return { status: response.status, body };
}

test('local auth and profile API flow', async (t) => {
  installModelFakes();
  const app = require('../src/app');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const signup = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: '테스트 사용자',
      email: 'User@Example.com',
      password: 'password123',
      jobRole: 'Backend Developer',
      defaultLanguage: 'ko',
      tools: ['Gmail'],
      communicationPreferences: ['concise'],
    }),
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.user.email, 'user@example.com');
  assert.equal(signup.body.user.defaultLanguage, 'Korean');
  assert.equal(signup.body.user.passwordHash, undefined);
  assert.ok(signup.body.accessToken);

  const duplicate = await request(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: '중복 사용자',
      email: 'user@example.com',
      password: 'password123',
    }),
  });
  assert.equal(duplicate.status, 400);

  const wrongLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'wrong-password' }),
  });
  assert.equal(wrongLogin.status, 401);

  const login = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
  });
  assert.equal(login.status, 200);
  assert.ok(login.body.accessToken);

  const unauthorizedProfile = await request(baseUrl, '/api/users/me');
  assert.equal(unauthorizedProfile.status, 401);

  const unauthorizedOptimize = await request(baseUrl, '/api/messages/optimize', {
    method: 'POST',
    body: JSON.stringify({ recipientIds: [1], subject: 'subject', body: 'body' }),
  });
  assert.equal(unauthorizedOptimize.status, 401);

  const unauthorizedSend = await request(baseUrl, '/api/messages/send', {
    method: 'POST',
    body: JSON.stringify({ messageId: 1, messageResultId: 1 }),
  });
  assert.equal(unauthorizedSend.status, 401);

  const unauthorizedDashboard = await request(baseUrl, '/api/dashboard/summary');
  assert.equal(unauthorizedDashboard.status, 401);

  const unauthorizedAiAnalysis = await request(baseUrl, '/api/ai/recipients/analyze', {
    method: 'POST',
    body: JSON.stringify({ recipient: { id: 7 } }),
  });
  assert.equal(unauthorizedAiAnalysis.status, 401);

  const unauthorizedRecipients = await request(baseUrl, '/api/recipients');
  assert.equal(unauthorizedRecipients.status, 401);

  const unauthorizedHistory = await request(baseUrl, '/api/history');
  assert.equal(unauthorizedHistory.status, 401);

  for (const protectedPath of [
    '/api/users',
    '/api/messages/drafts',
    '/api/team-memory',
    '/api/tags',
    '/api/notices',
  ]) {
    const response = await request(baseUrl, protectedPath);
    assert.equal(response.status, 401, `${protectedPath} must require authentication`);
  }

  const authorization = { authorization: `Bearer ${login.body.accessToken}` };

  const forbiddenUserList = await request(baseUrl, '/api/users', { headers: authorization });
  assert.equal(forbiddenUserList.status, 403);

  const recipientAnalysis = await request(baseUrl, '/api/ai/recipients/analyze', {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({ recipient: { id: 7 } }),
  });
  assert.equal(recipientAnalysis.status, 200);
  assert.deepEqual(recipientAnalysis.body.tags, ['concise']);

  const messageMetadata = await request(baseUrl, '/api/ai/messages/metadata', {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({
      recipients: [{ id: 7 }],
      subject: '검토 요청',
      body: '내일까지 검토해 주세요.',
    }),
  });
  assert.equal(messageMetadata.status, 200);
  assert.equal(messageMetadata.body.priority, 'NORMAL');

  const removedCompanyDna = await request(baseUrl, '/api/company-dna', { headers: authorization });
  assert.equal(removedCompanyDna.status, 404);

  const forbiddenNoticeCreate = await request(baseUrl, '/api/notices', {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({ title: 'notice', content: 'content' }),
  });
  assert.equal(forbiddenNoticeCreate.status, 403);

  storedUser.admin = true;
  const adminProfile = await request(baseUrl, '/api/users/me', { headers: authorization });
  assert.equal(adminProfile.status, 200);
  assert.equal(adminProfile.body.admin, true);

  const createdNotice = await request(baseUrl, '/api/notices', {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({ title: 'notice', content: 'content' }),
  });
  assert.equal(createdNotice.status, 201);
  storedUser.admin = false;

  const missingOldPassword = await request(baseUrl, '/api/auth/password', {
    method: 'PUT',
    headers: authorization,
    body: JSON.stringify({ newPassword: 'new-password-123' }),
  });
  assert.equal(missingOldPassword.status, 400);

  const wrongOldPassword = await request(baseUrl, '/api/auth/password', {
    method: 'PUT',
    headers: authorization,
    body: JSON.stringify({ oldPassword: 'wrong-password', newPassword: 'new-password-123' }),
  });
  assert.equal(wrongOldPassword.status, 400);

  const changedPassword = await request(baseUrl, '/api/auth/password', {
    method: 'PUT',
    headers: authorization,
    body: JSON.stringify({ oldPassword: 'password123', newPassword: 'new-password-123' }),
  });
  assert.equal(changedPassword.status, 200);

  const oldPasswordLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
  });
  assert.equal(oldPasswordLogin.status, 401);

  const newPasswordLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'new-password-123' }),
  });
  assert.equal(newPasswordLogin.status, 200);

  const profile = await request(baseUrl, '/api/users/me', { headers: authorization });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.onboardingCompleted, false);

  const completedOnboarding = await request(baseUrl, '/api/users/me/onboarding', {
    method: 'PATCH',
    headers: authorization,
  });
  assert.equal(completedOnboarding.status, 200);
  assert.equal(completedOnboarding.body.onboardingCompleted, true);

  const completedProfile = await request(baseUrl, '/api/users/me', { headers: authorization });
  assert.equal(completedProfile.body.onboardingCompleted, true);
  assert.equal(profile.body.name, '테스트 사용자');

  const updatedProfile = await request(baseUrl, '/api/users/me', {
    method: 'PATCH',
    headers: authorization,
    body: JSON.stringify({
      position: '팀원',
      customStyle: '핵심부터 간결하게 작성',
      communicationPreferences: ['concise', 'direct'],
    }),
  });
  assert.equal(updatedProfile.status, 200);
  assert.equal(updatedProfile.body.position, '팀원');
  assert.deepEqual(updatedProfile.body.communicationPreferences, ['concise', 'direct']);
});
