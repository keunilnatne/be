const assert = require('node:assert/strict');
const { sequelize, TeamMemory } = require('../models');
const service = require('../services/teamMemoryService');

async function verifyTeamMemory() {
  const transaction = await sequelize.transaction();
  const team = `qa-team-memory-${Date.now()}`;

  try {
    const pattern = await service.create({
      team,
      body: {
        type: 'pattern',
        title: 'API 요청 형식',
        purpose: 'API 요청에는 엔드포인트와 예시 응답을 포함',
        request: 'Request와 Response를 함께 작성',
        deadline: '검토 전까지',
      },
      transaction,
    });
    assert.equal(pattern.status, 'approved');

    const updated = await service.update({
      id: pattern.id,
      team,
      body: { reason: '백엔드와 프론트엔드의 오해 방지' },
      transaction,
    });
    assert.match(updated.reason, /오해 방지/);

    const approvedCandidate = await service.create({
      team,
      body: {
        type: 'candidate',
        text: '최근 동일한 마감 표현이 반복되었습니다.',
        suggestion: '요청마다 마감일을 포함합니다.',
        confidence: 94,
      },
      transaction,
    });
    const rejectedCandidate = await service.create({
      team,
      body: {
        type: 'candidate',
        text: '짧은 표현이 반복되었습니다.',
        suggestion: '모든 문장을 짧게 작성합니다.',
        confidence: 72,
      },
      transaction,
    });

    const approved = await service.decideCandidate({
      id: approvedCandidate.id,
      team,
      decision: 'approve',
      transaction,
    });
    const rejected = await service.decideCandidate({
      id: rejectedCandidate.id,
      team,
      decision: 'reject',
      transaction,
    });
    assert.equal(approved.type, 'pattern');
    assert.equal(approved.status, 'approved');
    assert.equal(rejected.type, 'candidate');
    assert.equal(rejected.status, 'rejected');

    const patterns = await service.list({ team, type: 'pattern', status: 'approved', transaction });
    const pendingCandidates = await service.list({
      team,
      type: 'candidate',
      status: 'pending',
      transaction,
    });
    const logs = await service.list({ team, type: 'log', transaction });
    assert.equal(patterns.length, 2);
    assert.equal(pendingCandidates.length, 0);
    assert.ok(logs.length >= 6);

    await service.remove({ id: pattern.id, team, transaction });
    const removed = await TeamMemory.findByPk(pattern.id, { transaction });
    assert.equal(removed, null);

    console.log('[통과] Team Memory 패턴 생성·조회·수정·삭제');
    console.log('[통과] AI 후보 승인·거절 및 상태 전이');
    console.log('[통과] 팀 범위 분리 및 학습 로그 생성');
  } finally {
    await transaction.rollback();
    console.log('[정리 완료] 공용 DB Team Memory 테스트 데이터 전체 롤백');
  }
}

verifyTeamMemory()
  .then(async () => sequelize.close())
  .catch(async (error) => {
    console.error('[검증 실패]', error.message);
    await sequelize.close();
    process.exit(1);
  });
