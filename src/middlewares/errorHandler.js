// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // ApiError와, 서비스 레이어에서 관례적으로 붙이는 일반 Error.statusCode(예: aiService의 502,
  // googleAuthService의 501/404, timezoneConverter의 400)를 동일하게 존중한다.
  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
  const message = err.message || '서버 오류가 발생했습니다.';

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    details: err.details,
    error: {
      code,
      message,
      details: err.details,
    },
  });
}

module.exports = errorHandler;
