const { Recipient } = require('../models');
const tagService = require('../services/tagService');
const aiService = require('../services/aiService');
const messageOptimizationService = require('../services/messageOptimizationService');
const messageSendService = require('../services/messageSendService');
const ApiError = require('../utils/ApiError');

const MAX_RECIPIENTS = 20;

function normalizeRecipientIds(body) {
  const candidates = Array.isArray(body.recipientIds)
    ? body.recipientIds
    : Array.isArray(body.recipients)
      ? body.recipients.map((recipient) => recipient?.id ?? recipient)
      : [];
  const ids = [...new Set(candidates.map(Number))];

  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw ApiError.badRequest('유효한 수신자를 한 명 이상 선택해야 합니다.');
  }
  if (ids.length > MAX_RECIPIENTS) {
    throw ApiError.badRequest(`수신자는 한 번에 최대 ${MAX_RECIPIENTS}명까지 선택할 수 있습니다.`);
  }
  return ids;
}

function createOptimizeHandler(optimizeMany = messageOptimizationService.optimizeMany) {
  return async (req, res) => {
  const subject = String(req.body.subject || '').trim();
  const body = String(req.body.body || '').trim();
  if (!subject || !body) throw ApiError.badRequest('subject, body는 필수입니다.');

  const recipientIds = normalizeRecipientIds(req.body);
  const { message, results } = await optimizeMany({
    senderId: req.user.id,
    recipientIds,
    subject,
    body,
    purpose: req.body.purpose,
    priority: req.body.priority,
  });

  const serializedResults = results.map((result) => ({
    id: result.id,
    recipientId: result.recipientId,
    recipientName: result.recipientName,
    recipientEmail: result.recipientEmail,
    subject: result.optimizedSubject,
    body: result.optimizedBody,
    appliedContext: result.appliedContext,
    qualityScore: result.qualityScore,
    status: result.status,
    error: result.errorMessage,
  }));
  const firstSuccess = serializedResults.find((result) => result.status === 'converted');

  res.status(201).json({
    messageId: message.id,
    originalSubject: message.originalSubject,
    originalBody: message.originalBody,
    results: serializedResults,
    // 현재 프론트의 단일 결과 계약과 임시 호환한다.
    subject: firstSuccess?.subject || null,
    body: firstSuccess?.body || null,
  });
  };
}

exports.createOptimizeHandler = createOptimizeHandler;
exports.optimize = createOptimizeHandler();

function createSendHandler(sendMany = messageSendService.sendMany) {
  return async (req, res) => {
    const messageId = Number(req.body.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0) {
      throw ApiError.badRequest('유효한 messageId가 필요합니다.');
    }
    const sent = await sendMany({
      senderId: req.user.id,
      messageId,
      results: req.body.results,
    });
    res.json({
      messageId: sent.message.id,
      status: sent.message.status,
      sentCount: sent.sentCount,
      failedCount: sent.failedCount,
      results: sent.outcomes.map(({ result, gmailMessageId, errorMessage }) => ({
        id: result.id,
        recipientId: result.recipientId,
        recipientEmail: result.recipientEmail,
        subject: result.finalSubject,
        body: result.finalBody,
        status: result.status,
        sentAt: result.sentAt,
        gmailMessageId,
        error: errorMessage,
      })),
    });
  };
}

exports.createSendHandler = createSendHandler;
exports.send = createSendHandler();

// 기존 단일 수신자 태그 기반 변환 API는 호환성을 위해 유지한다.
exports.convert = async (req, res) => {
  const { originalText, purpose, recipientId } = req.body;
  if (!originalText || !recipientId) {
    throw ApiError.badRequest('originalText, recipientId는 필수입니다.');
  }

  const recipient = await Recipient.findByPk(recipientId);
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');

  const tags = await tagService.getTagsForEntity('recipient', recipientId);
  const { convertedText } = await aiService.convertMessage({ originalText, purpose, tags });

  res.json({
    recipient: { id: recipient.id, name: recipient.name, jobRole: recipient.jobRole },
    appliedTags: tags.map((tag) => ({
      category: tag.category,
      name: tag.name,
      label: tag.label,
    })),
    originalText,
    convertedText,
  });
};

exports.createDraft = async (req, res) => {
  res.status(501).json({ message: 'TODO: 메시지 초안 저장 구현 필요' });
};

exports.analyzeContext = async (req, res) => {
  res.status(501).json({ message: 'TODO: 맥락 분석 및 보완 질문 생성 구현 필요 (FS-004)' });
};

exports.analyzeQuality = async (req, res) => {
  res.status(501).json({ message: 'TODO: 협업 적합도 분석 구현 필요 (FS-007)' });
};

exports.getOne = async (req, res) => {
  res.status(501).json({ message: 'TODO: 원문 및 변환문 비교 조회 구현 필요 (FS-008)' });
};

exports.saveRevision = async (req, res) => {
  res.status(501).json({ message: 'TODO: 사용자 최종 수정본 저장 구현 필요 (FS-008)' });
};
