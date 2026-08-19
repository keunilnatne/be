const test = require('node:test');
const assert = require('node:assert/strict');

const messageController = require('../src/controllers/message.controller');
const { Message, MessageResult } = require('../src/models');

test('draft save endpoint formats the stored recipient without a database dependency', async (t) => {
  const originals = {
    createMessage: Message.create,
    destroyResults: MessageResult.destroy,
    createResult: MessageResult.create,
    findResults: MessageResult.findAll,
  };
  t.after(() => {
    Message.create = originals.createMessage;
    MessageResult.destroy = originals.destroyResults;
    MessageResult.create = originals.createResult;
    MessageResult.findAll = originals.findResults;
  });

  const now = new Date('2026-08-20T00:00:00.000Z');
  const storedResults = [];
  Message.create = async (values) => ({
    id: 10,
    ...values,
    createdAt: now,
    updatedAt: now,
  });
  MessageResult.destroy = async () => {
    storedResults.length = 0;
  };
  MessageResult.create = async (values) => {
    storedResults.push(values);
    return values;
  };
  MessageResult.findAll = async () => storedResults;

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

  assert.equal(mockRes.statusCode, 201);
  assert.equal(createdDraft.subject, '임시 저장 테스트');
  assert.equal(createdDraft.body, '임시 저장 본문입니다.');
  assert.equal(createdDraft.recipients.length, 1);
  assert.equal(createdDraft.recipients[0].name, '김동료');
});
