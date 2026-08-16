const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('로그인이 필요합니다.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (error) {
    throw ApiError.unauthorized('유효하지 않거나 만료된 인증 토큰입니다.');
  }

  const user = await User.findByPk(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('인증된 사용자를 찾을 수 없습니다.');
  }

  req.user = user;
  next();
}

module.exports = authenticate;
