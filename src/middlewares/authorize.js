const ApiError = require('../utils/ApiError');

function requireRole(...roles) {
  return function authorizeRole(req, _res, next) {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.accountRole)) {
      throw ApiError.forbidden('이 작업을 수행할 권한이 없습니다.');
    }
    next();
  };
}

function requireCompanyAccess(req, _res, next) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.accountRole === 'admin') return next();

  const requestedCompanyId = Number(req.params.companyId);
  const userCompanyId = Number(req.user.companyId || 1);
  if (!Number.isFinite(requestedCompanyId) || requestedCompanyId !== userCompanyId) {
    throw ApiError.forbidden('다른 회사의 정보에 접근할 수 없습니다.');
  }
  next();
}

module.exports = { requireRole, requireCompanyAccess };
