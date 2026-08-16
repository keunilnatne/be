const test = require('node:test');
const assert = require('node:assert/strict');

const aiService = require('../src/services/aiService');
const qualityService = require('../src/services/messageQualityService');
const messageController = require('../src/controllers/message.controller');

function result(id, values = {}) {
  return {
    id,
    recipientId: id + 100,
    recipientName: `recipient ${id}`,
    optimizedSubject: `subject ${id}`,
    optimizedBody: `body ${id}`,
    finalSubject: null,
    finalBody: null,
    appliedContext: { recipient: { language: 'en', jobRole: 'developer' } },
    qualityScore: 90,
    async update(update) { Object.assign(this, update); return this; },
    ...values,
  };
}

test('quality prompt includes message and four evaluation categories', () => {
  const prompt = aiService.buildQualityPrompt({
    subject: 'Release', body: 'Please review.', purpose: 'review', recipientContext: { language: 'en' },
  });
  assert.match(prompt, /Release/);
  assert.match(prompt, /clarity/);
  assert.match(prompt, /tone/);
  assert.match(prompt, /culturalFit/);
  assert.match(prompt, /actionability/);
});

test('quality analysis stores each recipient score and breakdown without schema changes', async () => {
  const first = result(1);
  const second = result(2);
  let auditCreated = false;
  const outcomes = await qualityService.analyze({ userId: 7, messageId: 10 }, {
    findMessage: async () => ({ id: 10, purpose: 'review', results: [first, second] }),
    analyzeQuality: async ({ subject }) => ({
      overallScore: subject.endsWith('1') ? 94 : 88,
      breakdown: { clarity: 95, tone: 90, culturalFit: 92, actionability: 91 },
      strengths: ['clear'], improvements: ['deadline'], summary: 'good',
    }),
    createAnalysis: async () => { auditCreated = true; },
  });
  assert.equal(outcomes.length, 2);
  assert.equal(first.qualityScore, 94);
  assert.equal(second.qualityScore, 88);
  assert.equal(first.appliedContext.qualityAnalysis.breakdown.clarity, 95);
  assert.equal(auditCreated, true);
});

test('one quality-analysis failure does not stop other recipients', async () => {
  const first = result(1);
  const second = result(2);
  let call = 0;
  const outcomes = await qualityService.analyze({ userId: 7, messageId: 10 }, {
    findMessage: async () => ({ id: 10, purpose: 'review', results: [first, second] }),
    analyzeQuality: async () => {
      call += 1;
      if (call === 1) throw new Error('AI unavailable');
      return { overallScore: 90, breakdown: {}, strengths: [], improvements: [], summary: '' };
    },
    createAnalysis: async () => ({}),
  });
  assert.equal(outcomes[0].error, 'AI unavailable');
  assert.equal(outcomes[1].analysis.overallScore, 90);
});

test('quality analysis rejects another user message', async () => {
  await assert.rejects(qualityService.analyze({ userId: 7, messageId: 10 }, {
    findMessage: async () => null,
  }), /분석할 메시지를 찾을 수 없습니다/);
});

test('quality controller returns recipient-level results', async () => {
  const handler = messageController.createAnalyzeQualityHandler(async () => [{
    result: result(1),
    analysis: {
      overallScore: 93,
      breakdown: { clarity: 95, tone: 92, culturalFit: 90, actionability: 94 },
      strengths: ['clear'], improvements: [], summary: 'strong',
    },
    error: null,
  }]);
  let response;
  await handler(
    { user: { id: 7 }, params: { messageId: '10' }, body: {} },
    { json(value) { response = value; } }
  );
  assert.equal(response.successCount, 1);
  assert.equal(response.results[0].breakdown.clarity, 95);
});
