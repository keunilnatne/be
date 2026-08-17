const test = require('node:test');
const assert = require('node:assert/strict');

const optimizationService = require('../src/services/messageOptimizationService');
const sendService = require('../src/services/messageSendService');
const historyService = require('../src/services/historyService');
const dashboardService = require('../src/services/dashboardService');

test('optimize, send, history and dashboard share one stored message result', async () => {
  const store = { messages: [], results: [] };
  const now = new Date('2026-08-17T09:00:00Z');

  const optimized = await optimizationService.optimizeMany({
    senderId: 7,
    recipientIds: [3],
    subject: 'original subject',
    body: 'original body',
    purpose: 'demo request',
  }, {
    loadContext: async () => ({
      sender: { id: 7, jobRole: 'Backend Developer', defaultLanguage: 'Korean' },
      recipients: [{ id: 3, name: 'Alex', email: 'alex@example.com', language: 'English' }],
      companyDna: null,
      teamMemories: [],
    }),
    optimizeMessage: async () => ({
      subject: 'optimized subject',
      body: 'optimized body',
      qualityScore: 93,
    }),
    runTransaction: async (callback) => callback({ id: 'transaction' }),
    createMessage: async (values) => {
      const message = {
        id: 10,
        createdAt: now,
        results: [],
        ...values,
        async update(updates) { Object.assign(this, updates); return this; },
      };
      store.messages.push(message);
      return message;
    },
    createResults: async (values) => values.map((value, index) => {
      const result = {
        id: index + 20,
        createdAt: now,
        finalSubject: null,
        finalBody: null,
        sentAt: null,
        ...value,
        async update(updates) { Object.assign(this, updates); return this; },
      };
      store.results.push(result);
      return result;
    }),
  });

  optimized.message.results = optimized.results;
  assert.equal(store.messages.length, 1);
  assert.equal(store.results.length, 1);
  assert.equal(store.results[0].status, 'converted');

  const sent = await sendService.sendMany({
    senderId: 7,
    messageId: optimized.message.id,
    results: [{
      messageResultId: optimized.results[0].id,
      subject: 'final subject',
      body: 'final body',
    }],
  }, {
    findMessage: async ({ where }) => store.messages.find(
      (message) => message.id === where.id && message.senderId === where.senderId
    ) || null,
    getAccessToken: async () => 'access-token',
    sendMessage: async () => ({ id: 'gmail-message-1' }),
  });

  assert.equal(store.messages.length, 1, 'sending must not create another Message');
  assert.equal(store.results.length, 1, 'sending must update the existing MessageResult');
  assert.equal(sent.message.id, optimized.message.id);
  assert.equal(sent.outcomes[0].result.id, optimized.results[0].id);
  assert.equal(store.results[0].status, 'sent');
  assert.equal(store.results[0].finalSubject, 'final subject');

  const history = await historyService.list({ userId: 7 }, {
    findMessages: async ({ where }) => store.messages.filter(
      (message) => message.senderId === where.senderId
    ),
  });

  assert.equal(history.length, 1);
  assert.equal(history[0].id, String(store.results[0].id));
  assert.equal(history[0].messageId, String(store.messages[0].id));
  assert.equal(history[0].status, '전송 완료');
  assert.equal(history[0].subject, 'final subject');
  assert.equal(history[0].content, 'final body');

  const summary = await dashboardService.getSummary(7, {
    countMessages: async ({ where }) => store.messages.filter(
      (message) => message.senderId === where.senderId
    ).length,
    countResults: async ({ where }) => where.status === 'sent'
      ? store.results.filter((result) => result.status === 'sent').length
      : store.results.filter((result) => result.optimizedSubject && result.optimizedBody).length,
    countRecipients: async () => 1,
  });

  assert.equal(summary.totalMessages, 1);
  assert.equal(summary.aiConversions, 1);
  assert.equal(summary.sentMessages, 1);
  assert.equal(summary.recipients, 1);
});
