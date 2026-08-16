const test = require('node:test');
const assert = require('node:assert/strict');

const historyService = require('../src/services/historyService');
const dashboardService = require('../src/services/dashboardService');

function result(id, values = {}) {
  return {
    id,
    recipientName: `recipient ${id}`,
    recipientEmail: `recipient${id}@example.com`,
    optimizedSubject: `optimized ${id}`,
    optimizedBody: `body ${id}`,
    finalSubject: null,
    finalBody: null,
    qualityScore: 91,
    status: 'converted',
    errorMessage: null,
    createdAt: new Date('2026-08-17T10:00:00Z'),
    sentAt: null,
    ...values,
  };
}

function message(results) {
  return {
    id: 10,
    originalSubject: 'original subject',
    originalBody: 'original body',
    purpose: 'weekly report',
    createdAt: new Date('2026-08-17T09:00:00Z'),
    results,
  };
}

test('history flattens one message into recipient-level records', async () => {
  const items = await historyService.list({ userId: 7 }, {
    findMessages: async () => [message([
      result(1),
      result(2, {
        status: 'sent',
        finalSubject: 'final subject',
        finalBody: 'final body',
        sentAt: new Date('2026-08-18T01:00:00Z'),
      }),
    ])],
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].type, '변환');
  assert.equal(items[0].status, '대기 중');
  assert.equal(items[1].type, '전송');
  assert.equal(items[1].status, '전송 완료');
  assert.equal(items[1].content, 'final body');
});

test('history supports sent/converted filters and keyword search', async () => {
  const stored = message([
    result(1),
    result(2, { status: 'sent', finalBody: 'important launch plan' }),
  ]);
  const sent = await historyService.list({ userId: 7, type: 'sent', q: 'launch' }, {
    findMessages: async () => [stored],
  });
  const converted = await historyService.list({ userId: 7, type: 'converted' }, {
    findMessages: async () => [stored],
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, '2');
  assert.equal(converted.length, 1);
  assert.equal(converted[0].id, '1');
});

test('history detail is scoped to the authenticated sender', async () => {
  let options;
  const storedMessage = message([]);
  const item = await historyService.getOne({ userId: 7, id: 2 }, {
    findResult: async (query) => {
      options = query;
      return { ...result(2), Message: storedMessage };
    },
  });
  assert.equal(options.where.id, 2);
  assert.equal(options.include[0].where.senderId, 7);
  assert.equal(item.messageId, '10');
});

test('dashboard returns current frontend fields and compatibility totals', async () => {
  const counts = [5, 9, 6, 12];
  const summary = await dashboardService.getSummary(7, {
    countMessages: async () => counts[0],
    countResults: async (options) => options.where.status === 'sent' ? counts[2] : counts[1],
    countRecipients: async () => counts[3],
  });
  assert.deepEqual(summary, {
    sentMessages: 6,
    aiConversions: 9,
    recipients: 12,
    totalMessages: 5,
    totalRecipients: 12,
    aiOptimizedResults: 9,
  });
});
