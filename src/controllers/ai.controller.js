const { Recipient } = require('../models');
const aiService = require('../services/aiService');
const ApiError = require('../utils/ApiError');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

exports.analyzeRecipient = async (req, res) => {
  const input = req.body?.recipient;
  const recipientId = Number(input?.id);
  if (!isObject(input) || !Number.isInteger(recipientId) || recipientId <= 0) {
    throw ApiError.badRequest('분석할 수신자 정보가 필요합니다.');
  }

  const recipient = await Recipient.findOne({
    where: { id: recipientId, ownerUserId: req.user.id },
  });
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');

  res.json(await aiService.analyzeRecipientProfile(recipient.get({ plain: true })));
};

exports.analyzeMessageMetadata = async (req, res) => {
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  const requestedRecipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
  if (!subject && !body) {
    throw ApiError.badRequest('분석할 제목 또는 본문이 필요합니다.');
  }
  if (subject.length > 500 || body.length > 10000) {
    throw ApiError.badRequest('분석할 메시지가 너무 깁니다.');
  }

  const recipientIds = requestedRecipients.map((recipient) => Number(recipient?.id));
  if (recipientIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw ApiError.badRequest('올바른 수신자 정보가 필요합니다.');
  }

  const recipients = await Promise.all(recipientIds.map((id) => Recipient.findOne({
    where: { id, ownerUserId: req.user.id },
  })));
  if (recipients.some((recipient) => !recipient)) {
    throw ApiError.notFound('일부 수신자를 찾을 수 없습니다.');
  }

  res.json(await aiService.analyzeMessageMetadata({
    sender: req.user.get({ plain: true }),
    recipients: recipients.map((recipient) => recipient.get({ plain: true })),
    subject,
    body,
    sourceLanguage: req.body?.sourceLanguage,
    targetLanguages: req.body?.targetLanguages,
  }));
};
