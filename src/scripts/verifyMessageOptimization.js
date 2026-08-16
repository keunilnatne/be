const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const messageContextService = require('../services/messageContextService');
const optimizationService = require('../services/messageOptimizationService');

async function lastInsertId(transaction) {
  const [row] = await sequelize.query('SELECT LAST_INSERT_ID() AS id', {
    type: QueryTypes.SELECT,
    transaction,
  });
  return row.id;
}

async function insertAndGetId(sql, replacements, transaction) {
  await sequelize.query(sql, { replacements, transaction });
  return lastInsertId(transaction);
}

async function verifyMessageOptimization() {
  const transaction = await sequelize.transaction();
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const companyId = await insertAndGetId(
      'INSERT INTO companies (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
      [`IEUM QA ${unique}`],
      transaction
    );
    const senderId = await insertAndGetId(
      `INSERT INTO users
        (name, email, job_role, job_title, team, company_id, company_name,
         preferred_style, custom_style, default_language, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'AI 최적화 검증 사용자',
        `optimize-qa-${unique}@example.com`,
        'Backend Developer',
        'Team Member',
        `qa-team-${unique}`,
        companyId,
        `IEUM QA ${unique}`,
        'concise',
        '핵심 요청과 기한을 명확하게 작성',
        'Korean',
        'Asia/Seoul',
      ],
      transaction
    );

    await sequelize.query(
      `INSERT INTO company_dna
        (company_id, company_name, terms, rules, ai_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, true, NOW(), NOW())`,
      {
        replacements: [
          companyId,
          `IEUM QA ${unique}`,
          JSON.stringify([{ from: 'ASAP', to: '구체적인 기한' }]),
          JSON.stringify([{ id: 'email', title: '요청과 기한을 분명히 작성' }]),
        ],
        transaction,
      }
    );
    await sequelize.query(
      `INSERT INTO team_memories
        (team, type, title, purpose, status, created_at, updated_at)
       VALUES (?, 'pattern', ?, ?, 'approved', NOW(), NOW())`,
      {
        replacements: [
          `qa-team-${unique}`,
          '마감일 명시',
          '업무 요청에는 명확한 마감일을 포함',
        ],
        transaction,
      }
    );

    const recipientInputs = [
      ['Alex', 'Designer', 'United States', 'English', 'America/Los_Angeles', 'External Partner', ['concise', 'direct']],
      ['Yuki', 'Product Manager', 'Japan', 'Japanese', 'Asia/Tokyo', 'Client', ['formal', 'structured']],
    ];
    const recipientIds = [];
    for (const [name, jobRole, country, language, timezone, relationship, styles] of recipientInputs) {
      recipientIds.push(await insertAndGetId(
        `INSERT INTO recipients
          (owner_user_id, name, email, job_role, company, country, language, timezone,
           relationship, communication_style, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          senderId,
          name,
          `${name.toLowerCase()}-${unique}@example.com`,
          jobRole,
          'Global Partner',
          country,
          language,
          timezone,
          relationship,
          JSON.stringify(styles),
        ],
        transaction
      ));
    }

    const output = await optimizationService.optimizeMany(
      {
        senderId,
        recipientIds,
        subject: '2026-08-20 프로젝트 검토 요청',
        body: '담당자: 홍길동, 예산 ₩15,000,000 범위에서 2026-08-20까지 검토 부탁드립니다.',
        purpose: '프로젝트 검토 요청',
      },
      {
        loadContext: (input) => messageContextService.loadOptimizationContext({
          ...input,
          transaction,
        }),
        runTransaction: (callback) => callback(transaction),
      }
    );

    assert.equal(output.results.length, 2);
    assert.ok(output.results.every((result) => result.status === 'converted'));
    assert.ok(output.results.every((result) => result.optimizedSubject && result.optimizedBody));
    assert.notEqual(output.results[0].optimizedBody, output.results[1].optimizedBody);
    assert.ok(output.results.every((result) => result.appliedContext.companyDna));
    assert.ok(output.results.every((result) => result.appliedContext.teamMemories.length === 1));
    console.log('[통과] 실제 Gemini 수신자별 메시지 2개 생성');
    console.log('[통과] 원문 사실 보존 및 Company DNA·Team Memory 적용');
    console.log('[통과] Railway messages·message_results 저장');
  } finally {
    await transaction.rollback();
    console.log('[정리 완료] 공용 DB 테스트 데이터 전체 롤백');
  }
}

verifyMessageOptimization()
  .then(async () => sequelize.close())
  .catch(async (error) => {
    console.error('[검증 실패]', error.message);
    await sequelize.close();
    process.exit(1);
  });
