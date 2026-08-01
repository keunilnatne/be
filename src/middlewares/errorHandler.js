const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = err.message || '서버 오류가 발생했습니다.';

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
      details: err.details,
    },
  });
}

module.exports = errorHandler;
