const test = require('node:test');
const assert = require('node:assert/strict');

const {
  Message,
  MessageResult,
  User,
  Recipient,
} = require('../src/models');

test('Message matches the shared database writing-request schema', async () => {
  const message = Message.build({
    senderId: 1,
    originalSubject: '프로젝트 일정 확인',
    originalBody: '8월 20일까지 검토 부탁드립니다.',
  });

  await message.validate();
  assert.equal(message.status, 'optimized');
  assert.equal(message.priority, 'HIGH');
});

test('MessageResult keeps each recipient result separately', async () => {
  const first = MessageResult.build({
    messageId: 1,
    recipientId: 10,
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    optimizedSubject: 'Project schedule review',
    optimizedBody: 'Please review it by August 20.',
    appliedContext: { language: 'English', style: 'concise' },
    status: 'converted',
  });
  const second = MessageResult.build({
    messageId: 1,
    recipientId: 11,
    recipientName: '유키',
    recipientEmail: 'yuki@example.com',
  });

  await Promise.all([first.validate(), second.validate()]);
  assert.equal(first.status, 'converted');
  assert.equal(second.status, 'converted');
  assert.notEqual(first.recipientId, second.recipientId);
});

test('message model associations support history queries', () => {
  assert.ok(User.associations.Messages);
  assert.ok(Message.associations.results);
  assert.ok(Recipient.associations.MessageResults);
  assert.equal(MessageResult.associations.Message.target, Message);
});

test('invalid shared-database result states are rejected', async () => {
  const result = MessageResult.build({ messageId: 1, status: 'unknown' });
  await assert.rejects(result.validate(), /Validation isIn on status failed/);
});
