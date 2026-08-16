const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const {
  sequelize,
  Message,
  MessageResult,
} = require('../models');

async function lastInsertId(transaction) {
  const [row] = await sequelize.query('SELECT LAST_INSERT_ID() AS id', {
    transaction,
    type: QueryTypes.SELECT,
  });
  return row.id;
}

async function verifyMessageModels() {
  const transaction = await sequelize.transaction();

  try {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await sequelize.query(
      'INSERT INTO users (name, email, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      {
        replacements: ['메시지 DB 검증 사용자', `message-qa-${unique}@example.com`],
        transaction,
      }
    );
    const userId = await lastInsertId(transaction);

    const recipientInputs = [
      ['Alex', `alex-${unique}@example.com`, 'Designer'],
      ['Yuki', `yuki-${unique}@example.com`, 'Product Manager'],
    ];
    const recipients = [];
    for (const [name, email, jobRole] of recipientInputs) {
      await sequelize.query(
        `INSERT INTO recipients
          (owner_user_id, name, email, job_role, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        { replacements: [userId, name, email, jobRole], transaction }
      );
      recipients.push({ id: await lastInsertId(transaction), name, email });
    }

    const message = await Message.create(
      {
        senderId: userId,
        originalSubject: '프로젝트 일정 확인',
        originalBody: '8월 20일까지 검토 부탁드립니다.',
        purpose: '일정 확인 요청',
      },
      { transaction }
    );

    await MessageResult.bulkCreate(
      [
        {
          messageId: message.id,
          recipientId: recipients[0].id,
          recipientName: recipients[0].name,
          recipientEmail: recipients[0].email,
          optimizedSubject: 'Project schedule review',
          optimizedBody: 'Please review it by August 20.',
          appliedContext: { language: 'English', style: 'concise' },
        },
        {
          messageId: message.id,
          recipientId: recipients[1].id,
          recipientName: recipients[1].name,
          recipientEmail: recipients[1].email,
          optimizedSubject: 'プロジェクト日程のご確認',
          optimizedBody: '8月20日までにご確認をお願いいたします。',
          appliedContext: { language: 'Japanese', style: 'formal' },
        },
      ],
      { transaction }
    );

    const storedMessage = await Message.findByPk(message.id, {
      include: [{ model: MessageResult, as: 'results' }],
      transaction,
    });
    assert.equal(storedMessage.results.length, 2);
    assert.equal(storedMessage.originalSubject, '프로젝트 일정 확인');
    assert.ok(storedMessage.results.some(
      (result) => result.optimizedSubject === 'プロジェクト日程のご確認'
    ));
    console.log('[통과] 공용 DB 컬럼으로 수신자별 결과 2개 저장 및 다국어 조회');

    const firstResult = storedMessage.results.find(
      (result) => result.recipientId === recipients[0].id
    );
    await firstResult.update(
      {
        finalSubject: 'Final project schedule review',
        finalBody: 'Please review the final schedule by August 20.',
        status: 'sent',
        sentAt: new Date(),
      },
      { transaction }
    );
    await firstResult.reload({ transaction });
    assert.equal(firstResult.status, 'sent');
    assert.equal(firstResult.finalSubject, 'Final project schedule review');
    console.log('[통과] 최종 수정본 및 전송 상태 독립 변경');

    await message.destroy({ transaction });
    const remainingResults = await MessageResult.count({
      where: { messageId: message.id },
      transaction,
    });
    assert.equal(remainingResults, 0);
    console.log('[통과] 메시지 삭제 시 수신자별 결과 연쇄 삭제');
    console.log('[검증 완료] 모든 테스트 데이터 롤백');
  } finally {
    await transaction.rollback();
  }
}

verifyMessageModels()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error('[검증 실패]', error);
    await sequelize.close();
    process.exit(1);
  });
