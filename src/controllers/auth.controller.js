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

  // DB에 Google 로그인 유저 자동 생성 및 업데이트
  let user = await User.findOne({ where: { email: account.googleEmail } });
  if (!user) {
    user = await User.create({
      name: account.googleEmail.split('@')[0],
      email: account.googleEmail,
      googleConnected: true,
      googleEmail: account.googleEmail,
    });
    await UserSetting.create({ userId: user.id });
  } else {
    user.googleConnected = true;
    user.googleEmail = account.googleEmail;
    await user.save();
  }

  const token = generateToken(user);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // 프론트엔드(localhost:5173)의 프록시 경로로 리다이렉트하여 같은 origin 컨텍스트에서 postMessage 발송
  res.redirect(`${frontendUrl}/api/auth/google/success?email=${encodeURIComponent(account.googleEmail)}&token=${encodeURIComponent(token)}`);
};

// GET /api/auth/google/success
exports.googleSuccess = async (req, res) => {
  const { email, token } = req.query;
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Google 로그인 완료</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
  <div style="text-align: center; background: white; padding: 32px 40px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
    <div style="width: 48px; height: 48px; background: #e0e7ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4338ca" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>
    <h3 style="color: #1e1b4b; margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">Google 계정 로그인 성공</h3>
    <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0;">로그인이 완료되었습니다. 창이 자동으로 닫힙니다.</p>
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">${email || ''}</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'google-auth-success',
          email: ${JSON.stringify(email || '')},
          token: ${JSON.stringify(token || '')}
        }, window.location.origin);
        setTimeout(() => {
          window.close();
        }, 400);
      } else {
        window.location.href = '/welcome';
      }
    } catch (e) {
      window.location.href = '/welcome';
    }
  </script>
</body>
</html>
  `);
};


