// FS-001, FS-009: 로그인/가입, (추후) Google OAuth 연동
// TODO: 실제 인증 로직 구현

exports.signup = async (req, res) => {
  res.status(501).json({ message: 'TODO: 회원가입 구현 필요' });
};

exports.login = async (req, res) => {
  res.status(501).json({ message: 'TODO: 로그인 구현 필요' });
};

exports.googleCallback = async (req, res) => {
  res.status(501).json({ message: 'TODO: Google OAuth 콜백 구현 필요 (FS-009)' });
};
