const assert = require('node:assert/strict');
const {
  sequelize,
  User,
  Recipient,
  Message,
  MessageResult,
} = require('../models');

async function verifyMessageModels() {
  const transaction = await sequelize.transaction();

  try {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const user = await User.create(
      { name: '메시지 DB 검증 사용자', email: `message-qa-${unique}@example.com` },
      { transaction }
    );

    const recipients = await Recipient.bulkCreate(
      [
        {
          ownerUserId: user.id,
          name: 'Alex',
          email: `alex-${unique}@example.com`,
          jobRole: 'Designer',
        },
        {
          ownerUserId: user.id,
          name: 'Yuki',
          email: `yuki-${unique}@example.com`,
          jobRole: 'Product Manager',
        },
      ],
      { transaction, returning: true }
    );

    const message = await Message.create(
      {
        senderId: user.id,
        originalSubject: '프로젝트 일정 확인',
        originalBody: '8월 20일까지 검토 부탁드립니다.',
        purpose: '일정 확인 요청',
        status: 'optimized',
        optimizedAt: new Date(),
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
          targetLanguage: 'en',
          generatedSubject: 'Project schedule review',
          generatedBody: 'Please review it by August 20.',
          appliedContexts: [{ type: 'recipient', value: 'concise' }],
          status: 'optimized',
        },
        {
          messageId: message.id,
          recipientId: recipients[1].id,
          recipientName: recipients[1].name,
          recipientEmail: recipients[1].email,
          targetLanguage: 'ja',
          generatedSubject: 'プロジェクト日程のご確認',
          generatedBody: '8月20日までにご確認をお願いいたします。',
          appliedContexts: [{ type: 'recipient', value: 'formal' }],
          status: 'optimized',
        },
      ],
      { transaction }
    );

    const storedMessage = await Message.findByPk(message.id, {
      include: [{ model: MessageResult, as: 'results' }],
      transaction,
    });
    assert.equal(storedMessage.results.length, 2);
    assert.deepEqual(
      storedMessage.results.map((result) => result.targetLanguage).sort(),
      ['en', 'ja']
    );
    console.log('[통과] 메시지 1개에 수신자별 결과 2개 저장 및 조회');

    const firstResult = storedMessage.results.find(
      (result) => result.recipientId === recipients[0].id
    );
    await firstResult.update(
      {
        finalSubject: 'Final project schedule review',
        finalBody: 'Please review the final schedule by August 20.',
        status: 'sent',
        gmailMessageId: `gmail-${unique}`,
        sentAt: new Date(),
      },
      { transaction }
    );
    await firstResult.reload({ transaction });
    assert.equal(firstResult.status, 'sent');
    assert.ok(firstResult.gmailMessageId);
    console.log('[통과] 사용자 최종 수정본 및 Gmail 전송 상태 독립 변경');

    const firstRecipientId = recipients[0].id;
    await recipients[0].destroy({ transaction });
    await firstResult.reload({ transaction });
    assert.equal(firstResult.recipientId, null);
    assert.equal(firstResult.recipientName, 'Alex');
    assert.match(firstResult.recipientEmail, /^alex-/);
    console.log('[통과] 수신자 삭제 후에도 이름·이메일 스냅샷 보존');

    await message.destroy({ transaction });
    const remainingResults = await MessageResult.count({
      where: { messageId: message.id },
      transaction,
    });
    assert.equal(remainingResults, 0);
    console.log('[통과] 메시지 삭제 시 수신자별 결과 연쇄 삭제');
    console.log(`[검증 완료] 테스트 수신자 ID ${firstRecipientId}를 포함한 모든 테스트 데이터 롤백`);
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
