const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, UserSetting, Company, GmailIntegration } = require('../models');
const env = require('../config/env');
const googleAuthService = require('../services/googleAuthService');
const googleAccountStore = require('../services/googleAccountStore');
const tokenEncryption = require('../services/tokenEncryptionService');
const ApiError = require('../utils/ApiError');
const serializeUser = require('../utils/serializeUser');

const PASSWORD_MIN_LENGTH = 6;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, sub: String(user.id) }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn || '7d',
  });
}

function serializeAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobRole: user.jobRole || '',
    jobTitle: user.jobTitle || user.position || '',
    position: user.position || user.jobTitle || '',
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
  const email = normalizeEmail(req.body.email);
  const { name, password, jobRole, jobTitle, position, team, companyName, companyId } = req.body;
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
    passwordHash: hashedPassword,
    authProvider: 'local',
    accountRole: 'user',
    jobRole: jobRole || '',
    jobTitle: jobTitle || position || '',
    position: position || jobTitle || '',
    team: team || '',
    companyId: companyId || null,
    companyName: companyName || '',
  });

  try {
    await UserSetting.findOrCreate({ where: { userId: user.id } });
  } catch (e) {
    // ignore
  }

  const token = generateToken(user);
  res.status(201).json({
    token,
    accessToken: token,
    tokenType: 'Bearer',
    user: serializeAuthUser(user),
  });
};

// POST /api/auth/login - 이메일 로그인
exports.login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) {
    throw ApiError.badRequest('이메일과 비밀번호를 입력해 주세요.');
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw ApiError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const userPassword = user.password || user.passwordHash;
  if (!userPassword) {
    throw ApiError.badRequest('구글 로그인 계정입니다. 구글 로그인을 이용해 주세요.');
  }

  const isMatch = await bcrypt.compare(password, userPassword);
  if (!isMatch) {
    throw ApiError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const token = generateToken(user);
  res.json({
    token,
    accessToken: token,
    tokenType: 'Bearer',
    user: serializeAuthUser(user),
  });
};

// PUT /api/auth/password - 비밀번호 변경
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword) {
    throw ApiError.badRequest('새 비밀번호를 입력해 주세요.');
  }

  if (newPassword.length < 8) {
    throw ApiError.badRequest('새 비밀번호는 8자 이상이어야 합니다.');
  }

  const user = req.user;
  const currentPassword = user.password || user.passwordHash;

  if (oldPassword && currentPassword) {
    const isMatch = await bcrypt.compare(oldPassword, currentPassword);
    if (!isMatch) {
      throw ApiError.badRequest('기존 비밀번호가 일치하지 않습니다.');
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.passwordHash = hashedPassword;
  await user.save();

  res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
};


// GET /api/auth/google
exports.googleAuthUrl = async (req, res) => {
  const { userId, format } = req.query;
  const url = googleAuthService.getAuthUrl(userId || 'guest');
  if (format === 'json' || req.headers.accept?.includes('application/json')) {
    return res.json({ url });
  }
  res.redirect(url);
};

// GET /api/auth/google/callback
exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code) throw ApiError.badRequest('code가 필요합니다.');

  let account;
  try {
    account = await googleAuthService.handleCallback(code, state);
  } catch (err) {
    console.warn('[Google Callback Exception]:', err.message || err);
    const frontendUrl = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';

    // 이미 사용된 코드나 세션 만료 시 500 에러 대신 사용자 친화적 팝업 안내 반환
    return res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Google 로그인 안내</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
  <div style="text-align: center; background: white; padding: 32px 40px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); max-width: 400px;">
    <div style="width: 48px; height: 48px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    </div>
    <h3 style="color: #991b1b; margin: 0 0 8px 0; font-size: 17px; font-weight: 700;">Google 로그인 인증 세션 만료</h3>
    <p style="color: #4b5563; font-size: 13px; line-height: 1.5; margin: 0 0 20px 0;">
      인증 코드가 이미 사용되었거나 시간이 지났습니다.<br/>
      Google 로그인 버튼을 다시 클릭해 주세요.
    </p>
    <button onclick="window.close();" style="cursor: pointer; padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 13px;">
      창 닫기
    </button>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'google-auth-error', error: '인증 세션이 만료되었습니다. 다시 로그인해 주세요.' }, window.location.origin);
      }
    } catch (e) {}
  </script>
</body>
</html>
    `);
  }

  // DB에 Google 로그인 유저 자동 생성 및 업데이트
  let user = await User.findOne({ where: { email: account.googleEmail } });
  const isNewUser = !user;
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

  // Google OAuth 계정 스토어 및 GmailIntegration 즉시 연동
  try {
    await googleAccountStore.upsert(user.id, {
      googleEmail: account.googleEmail,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      expiryDate: account.expiryDate,
    });

    const rawToken = account.refreshToken || account.accessToken || 'google-token';
    const encryptedRefreshToken = tokenEncryption.encrypt(rawToken);
    const existingIntegration = await GmailIntegration.findOne({ where: { userId: user.id } });
    if (existingIntegration) {
      existingIntegration.googleEmail = account.googleEmail;
      existingIntegration.encryptedRefreshToken = encryptedRefreshToken;
      existingIntegration.scopes = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];
      existingIntegration.connectedAt = new Date();
      await existingIntegration.save();
    } else {
      await GmailIntegration.create({
        userId: user.id,
        googleEmail: account.googleEmail,
        encryptedRefreshToken,
        scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
        connectedAt: new Date(),
      });
    }
  } catch (syncErr) {
    console.warn('[Google Gmail integration auto-sync warn]:', syncErr.message);
  }

  const token = generateToken(user);
  const frontendUrl = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';
  const email = account.googleEmail;

  return res.type('html').send(`
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
          token: ${JSON.stringify(token || '')},
          isNewUser: ${JSON.stringify(isNewUser)}
        }, '*');
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        window.location.href = '${frontendUrl}/welcome${isNewUser ? '?newAccount=true' : ''}';
      }
    } catch (e) {
      window.location.href = '${frontendUrl}/welcome${isNewUser ? '?newAccount=true' : ''}';
    }
  </script>
</body>
</html>
  `);
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
        }, '*');
        setTimeout(() => {
          window.close();
        }, 500);
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


