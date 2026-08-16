const test = require('node:test');
const assert = require('node:assert/strict');

const {
  Message,
  MessageResult,
  User,
  Recipient,
} = require('../src/models');

test('Message represents one writing request', async () => {
  const message = Message.build({
    senderId: 1,
    originalSubject: '프로젝트 일정 확인',
    originalBody: '8월 20일까지 검토 부탁드립니다.',
  });

  await message.validate();
  assert.equal(message.status, 'draft');
  assert.equal(message.channel, 'email');
});

test('MessageResult keeps each recipient result and delivery status separately', async () => {
  const first = MessageResult.build({
    messageId: 1,
    recipientId: 10,
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    targetLanguage: 'en',
    generatedSubject: 'Project schedule review',
    generatedBody: 'Please review it by August 20.',
    appliedContexts: [{ type: 'recipient', value: 'concise' }],
    status: 'optimized',
  });
  const second = MessageResult.build({
    messageId: 1,
    recipientId: 11,
    recipientName: '유키',
    recipientEmail: 'yuki@example.com',
    targetLanguage: 'ja',
  });

  await Promise.all([first.validate(), second.validate()]);
  assert.equal(first.status, 'optimized');
  assert.equal(second.status, 'pending');
  assert.notEqual(first.recipientId, second.recipientId);
});

test('message model associations support history queries', () => {
  assert.ok(User.associations.Messages);
  assert.ok(Message.associations.results);
  assert.ok(Recipient.associations.MessageResults);
  assert.equal(MessageResult.associations.Message.target, Message);
});

test('invalid message states are rejected', async () => {
  const result = MessageResult.build({
    messageId: 1,
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    status: 'unknown',
  });

  await assert.rejects(result.validate(), /Validation isIn on status failed/);
});
