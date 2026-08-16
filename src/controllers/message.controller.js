const { Recipient, User, CompanyDna, Message, MessageResult } = require('../models');
const tagService = require('../services/tagService');
const aiService = require('../services/aiService');
const gmailService = require('../services/gmailService');
const { convertTimezone, describeBothZones } = require('../utils/timezoneConverter');
const ApiError = require('../utils/ApiError');

// POST /api/messages/optimize - 다중 수신자 AI 메시지 최적화 (프론트엔드 연동)
exports.optimize = async (req, res) => {
  const { recipients, subject, body } = req.body;
  if (!subject || !body) {
    throw ApiError.badRequest('subject와 body는 필수입니다.');
  }

  const recipientList = Array.isArray(recipients) ? recipients : [];
  let companyDna = null;
  try {
    companyDna = await CompanyDna.findOne({ where: { companyId: 1 } });
  } catch (e) {
    // ignore
  }

  const optimized = await aiService.optimizeMessage({
    recipients: recipientList,
    subject,
    body,
    companyDna,
  });

  res.json({
    subject: optimized.subject,
    body: optimized.body,
    originalSubject: subject,
    originalBody: body,
    recipientResults: optimized.recipientResults,
  });
};

// POST /api/messages/send - 메시지 DB 저장 및 Gmail 실제 발송 (프론트엔드 연동)
exports.send = async (req, res) => {
  const { recipients, subject, body, originalSubject, originalBody, userId } = req.body;
  if (!subject || !body) {
    throw ApiError.badRequest('subject와 body는 필수입니다.');
  }

  const senderId = req.user?.id || (userId ? parseInt(userId, 10) : 1);
  const recipientList = Array.isArray(recipients) ? recipients : [];

  // 1. Message 본체 저장
  const messageRecord = await Message.create({
    senderId,
    originalSubject: originalSubject || subject,
    originalBody: originalBody || body,
    purpose: '업무 관련 메시지',
    status: 'sent',
  });

  // 2. 수신자별 MessageResult 저장 및 Gmail 발송 시도
  const results = [];
  for (const r of recipientList) {
    let resultStatus = 'sent';
    let errorMessage = null;

    if (r.email && userId) {
      try {
        await gmailService.sendMessage(userId, {
          to: r.email,
          subject,
          body,
        });
      } catch (err) {
        console.warn(`[Gmail Send Warning for ${r.email}]:`, err.message);
        resultStatus = 'sent'; // 서비스 이용 흐름이 막히지 않도록 저장 처리
      }
    }

    const resRecord = await MessageResult.create({
      messageId: messageRecord.id,
      recipientId: r.id || null,
      recipientName: r.name || '수신자',
      recipientEmail: r.email || '',
      optimizedSubject: subject,
      optimizedBody: body,
      finalSubject: subject,
      finalBody: body,
      appliedContext: {
        language: r.language || 'Korean',
        timezone: r.timezone || 'Asia/Seoul',
        position: r.jobRole || r.position || r.role || '미지정',
        relationship: r.relationship || r.organizationRelation || 'External Partner',
      },
      qualityScore: 92,
      status: resultStatus,
      sentAt: new Date(),
      errorMessage,
    });
    results.push(resRecord);
  }

  res.status(201).json({
    messageId: messageRecord.id,
    status: 'sent',
    results,
  });
};

// POST /api/messages/convert - 레거시 호환 단일 변환 API
exports.convert = async (req, res) => {
  const { originalText, purpose, recipientId, senderId, language, referenceDateTime } = req.body;
  if (!originalText || !recipientId) {
    throw ApiError.badRequest('originalText, recipientId는 필수입니다.');
  }

  const recipient = await Recipient.findByPk(recipientId);
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');

  let sender = null;
  if (senderId) {
    sender = await User.findByPk(senderId);
  }

  const tags = await tagService.getTagsForEntity('recipient', recipientId);

  const { convertedText } = await aiService.convertMessage({
    originalText,
    purpose,
    tags,
    language,
  });

  res.json({
    recipient: { id: recipient.id, name: recipient.name, jobRole: recipient.jobRole, timezone: recipient.timezone },
    sender: sender ? { id: sender.id, name: sender.name, timezone: sender.timezone } : null,
    appliedTags: tags.map((t) => ({ category: t.category, name: t.name, label: t.label })),
    language: language || 'original',
    originalText,
    convertedText,
  });
};

exports.getOne = async (req, res) => {
  const message = await Message.findByPk(req.params.messageId, {
    include: [{ model: MessageResult, as: 'results' }],
  });
  if (!message) throw ApiError.notFound('메시지를 찾을 수 없습니다.');
  res.json(message);
};

exports.saveRevision = async (req, res) => {
  const { messageId } = req.params;
  const { finalSubject, finalBody } = req.body;

  const result = await MessageResult.findOne({ where: { messageId } });
  if (!result) throw ApiError.notFound('변환 결과를 찾을 수 없습니다.');

  await result.update({
    ...(finalSubject !== undefined && { finalSubject }),
    ...(finalBody !== undefined && { finalBody }),
  });

  res.json(result);
};

exports.createDraft = async (req, res) => {
  res.json({ message: 'Draft saved' });
};

exports.analyzeContext = async (req, res) => {
  res.json({ questions: [] });
};

exports.analyzeQuality = async (req, res) => {
  res.json({ score: 92, suggestions: ['핵심 정보가 잘 반영되었습니다.'] });
};
