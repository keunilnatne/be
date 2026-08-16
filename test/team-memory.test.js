const test = require('node:test');
const assert = require('node:assert/strict');

const { TeamMemory } = require('../src/models');
const teamMemoryService = require('../src/services/teamMemoryService');
const controller = require('../src/controllers/teamMemory.controller');

test('TeamMemory accepts shared database types and statuses', async () => {
  const pattern = TeamMemory.build({
    team: 'backend',
    type: 'pattern',
    title: 'API 요청 형식',
    status: 'approved',
  });
  const candidate = TeamMemory.build({
    team: 'backend',
    type: 'candidate',
    suggestion: '마감일을 포함합니다.',
    confidence: 92,
    status: 'pending',
  });
  await Promise.all([pattern.validate(), candidate.validate()]);
});

test('TeamMemory rejects unsupported type and status', async () => {
  await assert.rejects(
    TeamMemory.build({ type: 'unknown', status: 'approved' }).validate(),
    /Validation isIn on type failed/
  );
  await assert.rejects(
    TeamMemory.build({ type: 'pattern', status: 'unknown' }).validate(),
    /Validation isIn on status failed/
  );
});

test('pattern creation validates title before database access', async () => {
  await assert.rejects(
    teamMemoryService.create({ team: 'backend', body: { type: 'pattern', title: ' ' } }),
    /패턴 title은 필수입니다/
  );
});

test('candidate creation validates suggestion and confidence', async () => {
  await assert.rejects(
    teamMemoryService.create({ team: 'backend', body: { type: 'candidate' } }),
    /후보 suggestion은 필수입니다/
  );
  await assert.rejects(
    teamMemoryService.create({
      team: 'backend',
      body: { type: 'candidate', suggestion: '규칙', confidence: 101 },
    }),
    /confidence는 0부터 100 사이의 정수여야 합니다/
  );
});

test('serializer matches current frontend Pattern and Candidate fields', () => {
  const serialized = controller.serialize({
    id: 1,
    team: 'backend',
    type: 'pattern',
    title: '제목',
    purpose: '목적',
    reason: null,
    request: null,
    deadline: null,
    text: null,
    suggestion: null,
    confidence: 80,
    action: null,
    description: null,
    status: 'approved',
    updatedAt: new Date('2026-08-17T00:00:00Z'),
  });

  assert.equal(serialized.id, '1');
  assert.equal(serialized.reason, '');
  assert.equal(serialized.unread, false);
});
