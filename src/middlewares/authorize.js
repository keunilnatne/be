const ApiError = require('../utils/ApiError');

function requireAdmin(req, _res, next) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.admin !== true && Number(req.user.admin) !== 1) {
    throw ApiError.forbidden('관리자 권한이 필요합니다.');
  }
  next();
}

module.exports = { requireAdmin };
