const test = require('node:test');
const assert = require('node:assert/strict');

const { sequelize, Message, MessageResult } = require('../src/models');
const aiService = require('../src/services/aiService');
const contextService = require('../src/services/messageContextService');
const optimizationService = require('../src/services/messageOptimizationService');
const messageController = require('../src/controllers/message.controller');

const baseContext = {
  sender: { id: 1, jobRole: 'Backend Developer', defaultLanguage: 'Korean' },
  teamMemories: [{ id: 1, title: '마감일을 명확히 작성' }],
};

test('extractRequiredFacts extracts dates, amounts, percentages and owners', () => {
  const facts = optimizationService.extractRequiredFacts(
    '8월 20일 예산 검토',
    '담당자: 홍길동, 예산은 1,500만원이며 진행률은 70%입니다.'
  );

  assert.ok(facts.includes('8월 20일'));
  assert.ok(facts.includes('1,500만원'));
  assert.ok(facts.includes('70%'));
  assert.ok(facts.includes('홍길동'));
});

test('optimizeRecipient retries once when an original fact is missing', async (t) => {
  let calls = 0;
  const optimizeMessage = async () => {
    calls += 1;
    return calls === 1
      ? { subject: 'Review', body: 'Please review.', qualityScore: 80 }
      : { subject: 'Review by August 20', body: 'Please review by 8월 20일.', qualityScore: 90 };
  };

  const result = await optimizationService.optimizeRecipient(
    {
      ...baseContext,
      recipient: { id: 2, language: 'English' },
      subject: '일정 검토',
      body: '8월 20일까지 검토해주세요.',
    },
    optimizeMessage
  );

  assert.equal(calls, 2);
  assert.match(result.body, /8월 20일/);
});

test('optimizeRecipient fails after retry when facts remain missing', async (t) => {
  const optimizeMessage = async () => ({
    subject: 'Review',
    body: 'Please review.',
    qualityScore: 80,
  });

  await assert.rejects(
    optimizationService.optimizeRecipient(
      {
        ...baseContext,
        recipient: { id: 2, language: 'English' },
        subject: '예산 검토',
        body: '예산 1,500만원을 확인해주세요.',
      },
      optimizeMessage
    ),
    /원문 사실 보존에 실패했습니다/
  );
});

test('callAiWithRetry retries transient AI errors up to success', async () => {
  let calls = 0;
  const result = await optimizationService.callAiWithRetry(async () => {
    calls += 1;
    if (calls < 3) {
      const error = new Error('temporary overload');
      error.statusCode = 502;
      throw error;
    }
    return { subject: 'ok', body: 'ok', qualityScore: 90 };
  }, {});

  assert.equal(calls, 3);
  assert.equal(result.subject, 'ok');
});

test('matchesTargetLanguage distinguishes Korean and English output', () => {
  assert.equal(optimizationService.matchesTargetLanguage(
    { subject: 'Review', body: 'Please review the schedule.' },
    'English'
  ), true);
  assert.equal(optimizationService.matchesTargetLanguage(
    { subject: '검토 요청', body: '일정을 확인해 주세요.' },
    'English'
  ), false);
  assert.equal(optimizationService.matchesTargetLanguage(
    { subject: '검토 요청', body: '일정을 확인해 주세요.' },
    'Korean'
  ), true);
});

test('optimizeRecipient retries when output language differs from recipient language', async () => {
  let calls = 0;
  const result = await optimizationService.optimizeRecipient(
    {
      ...baseContext,
      recipient: { id: 2, language: 'English' },
      subject: '검토 요청',
      body: '일정을 확인해 주세요.',
    },
    async () => {
      calls += 1;
      return calls === 1
        ? { subject: '검토 요청', body: '일정을 확인해 주세요.', qualityScore: 80 }
        : { subject: 'Review request', body: 'Please review the schedule.', qualityScore: 90 };
    }
  );

  assert.equal(calls, 2);
  assert.equal(result.subject, 'Review request');
});

test('callAiWithRetry does not immediately retry a long quota delay', async () => {
  let calls = 0;
  await assert.rejects(
    optimizationService.callAiWithRetry(async () => {
      calls += 1;
      const error = new Error('quota exceeded');
      error.statusCode = 429;
      error.retryAfterMs = 50000;
      throw error;
    }, {}),
    /quota exceeded/
  );
  assert.equal(calls, 1);
});

test('optimizeMany stores success and failure per recipient', async (t) => {
  const loadContext = async () => ({
    ...baseContext,
    recipients: [
      { id: 10, name: 'Alex', email: 'alex@example.com', language: 'English' },
      { id: 11, name: 'Yuki', email: 'yuki@example.com', language: 'Japanese' },
    ],
  });
  const optimizeMessage = async ({ context }) => {
    if (context.recipient.language === 'Japanese') throw new Error('AI unavailable');
    return { subject: 'Hello', body: 'Message', qualityScore: 91 };
  };
  const runTransaction = async (callback) => callback({ id: 'test-transaction' });
  const createMessage = async (values) => ({ id: 100, ...values });
  const createResults = async (values) => values.map((value, index) => ({
    id: index + 1,
    ...value,
  }));

  const output = await optimizationService.optimizeMany(
    {
      senderId: 1,
      recipientIds: [10, 11],
      subject: 'Hello',
      body: 'Message',
    },
    { loadContext, optimizeMessage, runTransaction, createMessage, createResults }
  );

  assert.equal(output.results.length, 2);
  assert.equal(output.results[0].status, 'converted');
  assert.equal(output.results[1].status, 'failed');
  assert.equal(output.results[1].errorMessage, 'AI unavailable');
});

test('optimize controller accepts frontend recipients and returns results array', async (t) => {
  const optimizeMany = async () => ({
    message: { id: 7, originalSubject: '원문', originalBody: '본문' },
    results: [{
      id: 8,
      recipientId: 2,
      recipientName: 'Alex',
      recipientEmail: 'alex@example.com',
      optimizedSubject: 'Optimized',
      optimizedBody: 'Optimized body',
      appliedContext: {},
      qualityScore: 90,
      status: 'converted',
      errorMessage: null,
    }],
  });

  const req = {
    user: { id: 1 },
    body: {
      recipients: [{ id: '2', name: 'Alex' }],
      subject: '원문',
      body: '본문',
    },
  };
  const response = { statusCode: 200, payload: null };
  const res = {
    status(code) { response.statusCode = code; return this; },
    json(payload) { response.payload = payload; return this; },
  };

  await messageController.createOptimizeHandler(optimizeMany)(req, res);
  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.results.length, 1);
  assert.equal(response.payload.messageId, 7);
  assert.equal(response.payload.messageResultId, 8);
  assert.equal(response.payload.result.id, 8);
  assert.equal(response.payload.subject, 'Optimized');
  assert.equal(response.payload.body, 'Optimized body');
});
