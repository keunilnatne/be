const test = require('node:test');
const assert = require('node:assert/strict');

const gmailService = require('../src/services/gmailService');
const messageSendService = require('../src/services/messageSendService');
const messageController = require('../src/controllers/message.controller');

function result(id, values = {}) {
  return {
    id,
    recipientId: id + 100,
    recipientEmail: `recipient${id}@example.com`,
    optimizedSubject: `subject ${id}`,
    optimizedBody: `body ${id}`,
    finalSubject: null,
    finalBody: null,
    status: 'converted',
    sentAt: null,
    errorMessage: null,
    async update(update) { Object.assign(this, update); return this; },
    ...values,
  };
}

function message(results) {
  return {
    id: 10,
    status: 'optimized',
    results,
    async update(update) { Object.assign(this, update); return this; },
  };
}

test('raw Gmail message encodes UTF-8 subject, body and recipient', () => {
  const raw = gmailService.createRawMessage({
    to: 'receiver@example.com',
    subject: '회의 안내',
    body: '안녕하세요\n회의입니다.',
  });
  const mime = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(mime, /To: receiver@example.com/);
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.match(mime, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(mime, new RegExp(Buffer.from('안녕하세요\r\n회의입니다.').toString('base64')));
});

test('sendMany sends one recipient and stores final edits', async () => {
  const first = result(1);
  const storedMessage = message([first]);
  const calls = [];
  const sent = await messageSendService.sendMany({
    senderId: 7,
    messageId: 10,
    results: [{ messageResultId: 1, subject: 'final subject', body: 'final body' }],
  }, {
    findMessage: async () => storedMessage,
    getAccessToken: async () => 'access-token',
    sendMessage: async (input) => { calls.push(input); return { id: `gmail-${calls.length}` }; },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, 'recipient1@example.com');
  assert.equal(first.finalSubject, 'final subject');
  assert.equal(first.finalBody, 'final body');
  assert.equal(first.status, 'sent');
  assert.equal(sent.sentCount, 1);
  assert.equal(storedMessage.status, 'sent');
});

test('sendMany rejects an old message with multiple unselected recipients', async () => {
  const first = result(1);
  const second = result(2);
  const storedMessage = message([first, second]);
  await assert.rejects(
    messageSendService.sendMany({ senderId: 7, messageId: 10 }, {
      findMessage: async () => storedMessage,
      getAccessToken: async () => 'access-token',
      sendMessage: async () => ({ id: 'should-not-send' }),
    }),
    /한 번에 한 명에게만 발송/
  );
});

test('temporary Gmail failure is retried once', async () => {
  let attempts = 0;
  const response = await messageSendService.sendWithRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error('temporary');
      error.statusCode = 503;
      throw error;
    }
    return { id: 'gmail-after-retry' };
  }, { to: 'recipient@example.com' });
  assert.equal(attempts, 2);
  assert.equal(response.id, 'gmail-after-retry');
});

test('a previously failed Gmail send can be retried when optimized content exists', async () => {
  const retryResult = result(1, { status: 'failed', errorMessage: 'previous Gmail error' });
  const storedMessage = message([retryResult]);
  const sent = await messageSendService.sendMany({ senderId: 7, messageId: 10 }, {
    findMessage: async () => storedMessage,
    getAccessToken: async () => 'access-token',
    sendMessage: async () => ({ id: 'gmail-retried' }),
  });
  assert.equal(sent.sentCount, 1);
  assert.equal(retryResult.status, 'sent');
  assert.equal(retryResult.errorMessage, null);
});

test('recipient address rejects header injection', async () => {
  const invalid = result(1, { recipientEmail: 'safe@example.com\r\nBcc: attacker@example.com' });
  const storedMessage = message([invalid]);
  let called = false;
  const sent = await messageSendService.sendMany({ senderId: 7, messageId: 10 }, {
    findMessage: async () => storedMessage,
    getAccessToken: async () => 'access-token',
    sendMessage: async () => { called = true; return {}; },
  });
  assert.equal(called, false);
  assert.equal(sent.failedCount, 1);
  assert.match(invalid.errorMessage, /유효한 수신자 이메일/);
});

test('sendMany rejects messages not owned by the authenticated sender', async () => {
  await assert.rejects(messageSendService.sendMany({ senderId: 7, messageId: 10 }, {
    findMessage: async () => null,
  }), /발송할 메시지를 찾을 수 없습니다/);
});

test('send controller returns recipient-level summary', async () => {
  const handler = messageController.createSendHandler(async () => ({
    message: { id: 10, status: 'sent' },
    sentCount: 1,
    failedCount: 0,
    outcomes: [{ result: result(1, { status: 'sent' }), gmailMessageId: 'gmail-1', errorMessage: null }],
  }));
  let response;
  await handler(
    { user: { id: 7 }, body: { messageId: 10 } },
    { json(value) { response = value; } }
  );
  assert.equal(response.sentCount, 1);
  assert.equal(response.results[0].gmailMessageId, 'gmail-1');
});
