const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // ApiError와, 서비스 레이어에서 관례적으로 붙이는 일반 Error.statusCode(예: aiService의 502,
  // googleAuthService의 501/404, timezoneConverter의 400)를 동일하게 존중한다.
  const statusCode = err.statusCode || 500;
  const code = err instanceof ApiError
    ? err.code
    : ApiError.codeForStatus(statusCode);
  const message = err.message || '서버 오류가 발생했습니다.';
  const details = err.details ?? null;

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    details,
    error: {
      code,
      message,
      details,
    },
  });
}

module.exports = errorHandler;
