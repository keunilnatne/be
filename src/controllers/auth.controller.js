// FS-001, FS-009: 로그인/가입, Google OAuth(Gmail) 연동
const googleAuthService = require('../services/googleAuthService');
const ApiError = require('../utils/ApiError');

// TODO: 실제 회원가입/로그인(세션) 구현 필요. 지금은 users CRUD(/api/users)로 대체.
exports.signup = async (req, res) => {
  res.status(501).json({ message: 'TODO: 회원가입 구현 필요' });
};

exports.login = async (req, res) => {
  res.status(501).json({ message: 'TODO: 로그인 구현 필요' });
};

// GET /api/auth/google?userId=1 -> Google 동의 화면으로 리다이렉트
exports.googleAuthUrl = async (req, res) => {
  const { userId } = req.query;
  if (!userId) throw ApiError.badRequest('userId 쿼리 파라미터가 필요합니다.');

  const url = googleAuthService.getAuthUrl(userId);
  res.redirect(url);
};

// GET /api/auth/google/callback -> 토큰 교환 후 프론트로 리다이렉트
exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) throw ApiError.badRequest('code, state가 필요합니다.');

  const account = await googleAuthService.handleCallback(code, state);
  res.redirect(`/gmail.html?connected=1&userId=${state}&email=${encodeURIComponent(account.googleEmail)}`);
};
