const test = require('node:test');
const assert = require('node:assert/strict');

const ApiError = require('../src/utils/ApiError');
const errorHandler = require('../src/middlewares/errorHandler');

function render(error) {
  const response = {};
  errorHandler(error, {}, {
    status(statusCode) { response.statusCode = statusCode; return this; },
    json(body) { response.body = body; return this; },
  }, () => {});
  return response;
}

test('common API errors have stable status-specific codes', () => {
  assert.equal(ApiError.badRequest('bad').code, 'VALIDATION_ERROR');
  assert.equal(ApiError.unauthorized().code, 'AUTHENTICATION_REQUIRED');
  assert.equal(ApiError.forbidden().code, 'ACCESS_DENIED');
  assert.equal(ApiError.notFound().code, 'RESOURCE_NOT_FOUND');
  assert.equal(new ApiError(409, 'conflict').code, 'CONFLICT');
});

test('error handler returns the common top-level response and compatibility error object', () => {
  const response = render(ApiError.notFound('메시지를 찾을 수 없습니다.'));

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, {
    success: false,
    code: 'RESOURCE_NOT_FOUND',
    message: '메시지를 찾을 수 없습니다.',
    details: null,
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: '메시지를 찾을 수 없습니다.',
      details: null,
    },
  });
});

test('non-ApiError codes are not exposed as public API error codes', () => {
  const error = new Error('database unavailable');
  error.statusCode = 503;
  error.code = 'ECONNREFUSED';
  const response = render(error);

  assert.equal(response.body.code, 'SERVICE_UNAVAILABLE');
  assert.notEqual(response.body.code, 'ECONNREFUSED');
});
