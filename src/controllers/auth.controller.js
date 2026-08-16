const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Company } = require('../models');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const serializeUser = require('../utils/serializeUser');

const PASSWORD_MIN_LENGTH = 8;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateSignupInput({ name, email, password }) {
  if (!String(name || '').trim() || !email || !password) {
    throw ApiError.badRequest('name, email, password는 필수입니다.');
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw ApiError.badRequest('올바른 이메일 형식이 아닙니다.');
  }
  if (String(password).length < PASSWORD_MIN_LENGTH) {
    throw ApiError.badRequest(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
  }
}

function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), accountRole: user.accountRole },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

async function authResponse(user) {
  const loadedUser = await User.findByPk(user.id, { include: [Company] });
  return {
    accessToken: createAccessToken(loadedUser),
    tokenType: 'Bearer',
    user: await serializeUser(loadedUser),
  };
}

exports.signup = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const {
    name,
    password,
    jobRole,
    position,
    team,
    defaultLanguage,
    tools,
    communicationPreferences,
    customStyle,
    companyId,
  } = req.body;

  validateSignupInput({ name, email, password });

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) throw new ApiError(409, '이미 가입된 이메일입니다.');

  if (companyId !== undefined && companyId !== null) {
    const company = await Company.findByPk(companyId);
    if (!company) throw ApiError.badRequest('존재하지 않는 회사입니다.');
  }

  const user = await User.create({
    name: String(name).trim(),
    email,
    passwordHash: await bcrypt.hash(String(password), 12),
    authProvider: 'local',
    accountRole: 'user',
    jobRole: jobRole || null,
    position: position || null,
    team: team || null,
    defaultLanguage: defaultLanguage || 'ko',
    tools: Array.isArray(tools) ? tools : [],
    communicationPreferences: Array.isArray(communicationPreferences)
      ? communicationPreferences
      : [],
    customStyle: customStyle || null,
    companyId: companyId || null,
  });

  res.status(201).json(await authResponse(user));
};

exports.login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  if (!email || !password) {
    throw ApiError.badRequest('email, password는 필수입니다.');
  }

  const user = await User.findOne({ where: { email } });
  const passwordMatches = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    throw ApiError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  res.json(await authResponse(user));
};

exports.googleCallback = async (req, res) => {
  res.status(501).json({ message: 'TODO: Google OAuth 콜백 구현 필요 (FS-009)' });
};
