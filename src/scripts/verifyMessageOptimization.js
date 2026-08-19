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
    const senderId = await insertAndGetId(
      `INSERT INTO users
        (name, email, job_role, job_title, team, preferred_style, custom_style,
         default_language, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'Optimization QA User',
        `optimize-qa-${unique}@example.com`,
        'Backend Developer',
        'Team Member',
        `qa-team-${unique}`,
        'concise',
        'Keep requests and deadlines explicit.',
        'Korean',
        'Asia/Seoul',
      ],
      transaction
    );

    await sequelize.query(
      `INSERT INTO team_memories
        (team, user_id, type, title, purpose, status, created_at, updated_at)
       VALUES (?, ?, 'pattern', ?, ?, 'approved', NOW(), NOW())`,
      {
        replacements: [
          `qa-team-${unique}`,
          senderId,
          'Deadline clarity',
          'Include an explicit deadline in work requests.',
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
        subject: 'Project review request',
        body: 'Please review the attached project proposal by 2026-08-20. The budget is KRW 5,000,000.',
        purpose: 'Project review request',
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
    assert.ok(output.results.every((result) => result.appliedContext.teamMemories.length === 1));
    console.log('[PASS] Generated two recipient-specific optimized messages.');
    console.log('[PASS] Original facts and Team Memory were applied.');
  } finally {
    await transaction.rollback();
    console.log('[CLEANUP] Rolled back all verification data.');
  }
}

verifyMessageOptimization()
  .then(async () => sequelize.close())
  .catch(async (error) => {
    console.error('[FAIL]', error.message);
    await sequelize.close();
    process.exit(1);
  });
