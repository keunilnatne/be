const test = require('node:test');
const assert = require('node:assert/strict');

const messageController = require('../src/controllers/message.controller');
const messageSendService = require('../src/services/messageSendService');

test('message API accepts exactly one recipient', () => {
  const recipient = { id: 1, name: 'Alex' };
  assert.equal(messageController.requireSingleRecipient([recipient]), recipient);
});

test('message API rejects zero or multiple recipients', () => {
  assert.throws(() => messageController.requireSingleRecipient([]), /수신자 한 명만 선택/);
  assert.throws(
    () => messageController.requireSingleRecipient([{ id: 1 }, { id: 2 }]),
    /수신자 한 명만 선택/
  );
});

test('stored-message send accepts only one selected result', () => {
  assert.equal(messageSendService.overridesById([{ messageResultId: 10 }]).size, 1);
  assert.throws(
    () => messageSendService.overridesById([
      { messageResultId: 10 },
      { messageResultId: 11 },
    ]),
    /결과 한 개만 지정/
  );
});
