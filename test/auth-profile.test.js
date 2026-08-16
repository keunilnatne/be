const test = require('node:test');
const assert = require('node:assert/strict');

const { User, Company } = require('../src/models');
const tagService = require('../src/services/tagService');

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
    };
    return storedUser;
  };
  Company.findByPk = async () => null;
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
  return { status: response.status, body: await response.json() };
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
  assert.equal(signup.body.user.defaultLanguage, 'ko');
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
  assert.equal(duplicate.status, 409);

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

  const authorization = { authorization: `Bearer ${login.body.accessToken}` };
  const profile = await request(baseUrl, '/api/users/me', { headers: authorization });
  assert.equal(profile.status, 200);
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
