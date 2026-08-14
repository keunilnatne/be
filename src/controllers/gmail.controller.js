const gmailService = require('../services/gmailService');
const googleAuthService = require('../services/googleAuthService');
const ApiError = require('../utils/ApiError');

// FS-009: Gmail 연동 및 이메일 작성 (MVP: 받은 편지함 조회, 발송)
exports.status = async (req, res) => {
  const { userId } = req.query;
  if (!userId) throw ApiError.badRequest('userId는 필수입니다.');
  res.json(googleAuthService.getStatus(userId));
};

exports.listInbox = async (req, res) => {
  const { userId } = req.query;
  if (!userId) throw ApiError.badRequest('userId는 필수입니다.');
  const messages = await gmailService.listMessages(userId, { maxResults: 10 });
  res.json(messages);
};

exports.getMessage = async (req, res) => {
  const { userId } = req.query;
  if (!userId) throw ApiError.badRequest('userId는 필수입니다.');
  const message = await gmailService.getMessage(userId, req.params.messageId);
  res.json(message);
};

exports.send = async (req, res) => {
  const { userId, to, subject, body } = req.body;
  if (!userId || !to || !subject || !body) {
    throw ApiError.badRequest('userId, to, subject, body는 필수입니다.');
  }

  const result = await gmailService.sendMessage(userId, { to, subject, body });
  res.json({ id: result.id, status: 'sent' });
};
