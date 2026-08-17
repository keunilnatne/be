const test = require('node:test');
const assert = require('node:assert/strict');

const aiService = require('../src/services/aiService');
const ApiError = require('../src/utils/ApiError');
const errorHandler = require('../src/middlewares/errorHandler');

test('invalid AI JSON is rejected instead of returning the original message', () => {
  assert.throws(
    () => aiService.parseRequiredJson('not-json', ['subject', 'body']),
    (error) => error.code === 'AI_GENERATION_FAILED'
      && error.statusCode === 502
      && error.details.reason === 'INVALID_AI_JSON'
  );
});

test('AI errors use the frontend-safe common error response', () => {
  const error = ApiError.aiGenerationFailed(503, { reason: 'AI_NOT_CONFIGURED' });
  const response = { statusCode: null, payload: null };
  const res = {
    status(code) { response.statusCode = code; return this; },
    json(payload) { response.payload = payload; return this; },
  };

  errorHandler(error, {}, res, () => {});

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.payload, {
    success: false,
    code: 'AI_GENERATION_FAILED',
    message: '메시지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
    details: { reason: 'AI_NOT_CONFIGURED' },
    error: {
      code: 'AI_GENERATION_FAILED',
      message: '메시지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
      details: { reason: 'AI_NOT_CONFIGURED' },
    },
  });
});
