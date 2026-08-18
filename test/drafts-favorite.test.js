const test = require('node:test');
const assert = require('node:assert/strict');

const messageController = require('../src/controllers/message.controller');
const recipientController = require('../src/controllers/recipient.controller');
const { Message, MessageResult, Recipient, sequelize } = require('../src/models');

test('draft list and save endpoints format drafts correctly', async () => {
  let createdDraft = null;
  const mockReq = {
    user: { id: 999 },
    body: {
      subject: '임시 저장 테스트',
      body: '임시 저장 본문입니다.',
      recipients: [{ id: 1, name: '김동료', position: 'PM', company: '이음', email: 'colleague@example.com' }],
    },
  };
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      createdDraft = data;
      return data;
    },
  };

  await messageController.saveDraft(mockReq, mockRes);
  assert.ok(createdDraft);
  assert.equal(createdDraft.subject, '임시 저장 테스트');
  assert.equal(createdDraft.body, '임시 저장 본문입니다.');
  assert.equal(createdDraft.recipients.length, 1);
  assert.equal(createdDraft.recipients[0].name, '김동료');
});
