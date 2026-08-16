const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, UserSetting } = require('../models');
const googleAuthService = require('../services/googleAuthService');
const ApiError = require('../utils/ApiError');

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn || '7d',
  });
}

function serializeAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobRole: user.jobRole || '',
    jobTitle: user.jobTitle || '',
    team: user.team || '',
    companyId: user.companyId || null,
    companyName: user.companyName || '',
    defaultLanguage: user.defaultLanguage || 'Korean',
    timezone: user.timezone || 'Asia/Seoul',
    googleConnected: !!user.googleConnected,
    googleEmail: user.googleEmail || '',
  };
}

// POST /api/auth/signup - 이메일 회원가입
exports.signup = async (req, res) => {
  const { name, email, password, jobRole, team, companyName } = req.body;
  if (!name || !email || !password) {
    throw ApiError.badRequest('이름, 이메일, 비밀번호는 필수입니다.');
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw ApiError.badRequest('이미 가입된 이메일입니다.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    jobRole: jobRole || '',
    team: team || '',
    companyName: companyName || '',
  });

  await UserSetting.create({ userId: user.id });

  const token = generateToken(user);
  res.status(201).json({
    token,
    user: serializeAuthUser(user),
  });
};

// POST /api/auth/login - 이메일 로그인
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw ApiError.badRequest('이메일과 비밀번호를 입력해 주세요.');
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw ApiError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  if (!user.password) {
    throw ApiError.badRequest('구글 로그인 계정입니다. 구글 로그인을 이용해 주세요.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw ApiError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const token = generateToken(user);
  res.json({
    token,
    user: serializeAuthUser(user),
  });
};

// PUT /api/auth/password - 비밀번호 변경
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw ApiError.badRequest('기존 비밀번호와 새 비밀번호를 입력해 주세요.');
  }

  const user = req.user;
  if (!user.password) {
    throw ApiError.badRequest('구글 계정은 비밀번호를 변경할 수 없습니다.');
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw ApiError.badRequest('기존 비밀번호가 일치하지 않습니다.');
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
};

// GET /api/auth/google
exports.googleAuthUrl = async (req, res) => {
  const { userId } = req.query;
  const url = googleAuthService.getAuthUrl(userId || 'guest');
  res.redirect(url);
};

// GET /api/auth/google/callback
exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code) throw ApiError.badRequest('code가 필요합니다.');

  const account = await googleAuthService.handleCallback(code, state);
  res.redirect(`/gmail.html?connected=1&userId=${state}&email=${encodeURIComponent(account.googleEmail)}`);
};
