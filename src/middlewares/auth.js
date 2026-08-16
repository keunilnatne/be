const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('인증 토큰이 필요합니다.');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      throw ApiError.unauthorized('존재하지 않는 사용자입니다.');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('유효하지 않거나 만료된 토큰입니다.');
  }
};
