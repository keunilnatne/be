const gmailService = require('../services/gmailService');
const googleAuthService = require('../services/googleAuthService');
const ApiError = require('../utils/ApiError');

function getEffectiveUserId(req) {
  const id = req.user?.id || req.query.userId || req.body?.userId;
  if (!id) throw ApiError.badRequest('인증 정보(userId)가 필요합니다.');
  return Number(id);
}

// FS-009: Gmail 연동 및 이메일 작성 (받은 편지함 조회, 상세 조회, 발송)
exports.status = async (req, res) => {
  try {
    const userId = getEffectiveUserId(req);
    const status = await googleAuthService.getStatus(userId);
    res.json(status);
  } catch (error) {
    if (error.statusCode) throw error;
    res.json({ connected: false, email: null });
  }
};

exports.listInbox = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const maxResults = Number(req.query.maxResults) || 50;
  const q = req.query.q || undefined;
  try {
    const messages = await gmailService.listMessages(userId, { maxResults, q });
    res.json(messages);
  } catch (error) {
    if (error.code === 'GMAIL_NOT_CONNECTED' || error.message?.includes('연결된 Gmail 계정이 없습니다')) {
      return res.status(409).json({
        code: 'GMAIL_NOT_CONNECTED',
        message: 'Gmail 계정이 연동되어 있지 않습니다.',
        messages: [],
      });
    }
    throw error;
  }
};

exports.getMessage = async (req, res) => {
  const userId = getEffectiveUserId(req);
  try {
    const message = await gmailService.getMessage(userId, req.params.messageId);
    res.json(message);
  } catch (error) {
    if (error.code === 'GMAIL_NOT_CONNECTED' || error.message?.includes('연결된 Gmail 계정이 없습니다')) {
      return res.status(409).json({
        code: 'GMAIL_NOT_CONNECTED',
        message: 'Gmail 계정이 연동되어 있지 않습니다.',
      });
    }
    throw error;
  }
};

exports.getAttachment = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { messageId, attachmentId } = req.params;
  const { filename, mimeType } = req.query;

  try {
    const attachment = await gmailService.getAttachment(userId, messageId, attachmentId);
    const buffer = Buffer.from(attachment.data, 'base64url');

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    if (filename) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
    }
    res.send(buffer);
  } catch (error) {
    if (error.code === 'GMAIL_NOT_CONNECTED' || error.message?.includes('연결된 Gmail 계정이 없습니다')) {
      return res.status(409).json({
        code: 'GMAIL_NOT_CONNECTED',
        message: 'Gmail 계정이 연동되어 있지 않습니다.',
      });
    }
    throw error;
  }
};

exports.send = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { to, subject, body } = req.body;
  if (!to || !subject || !body) {
    throw ApiError.badRequest('to, subject, body는 필수입니다.');
  }

  const result = await gmailService.sendMessage(userId, { to, subject, body });
  res.json({ id: result.id, status: 'sent' });
};
