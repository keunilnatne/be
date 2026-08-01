const { Recipient } = require('../models');
const tagService = require('../services/tagService');
const aiService = require('../services/aiService');
const ApiError = require('../utils/ApiError');

// FS-005/006 MVP: 수신자에게 붙은 태그를 프롬프트 컨텍스트로 주입해 메시지를 변환
// (메시지 영속화, 맥락 분석, 품질 분석, 원문 비교/수정은 다음 단계에서 구현)
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
    appliedTags: tags.map((t) => ({ category: t.category, name: t.name, label: t.label })),
    originalText,
    convertedText,
  });
};

exports.createDraft = async (req, res) => {
  res.status(501).json({ message: 'TODO: 메시지 초안 저장 구현 필요' });
};

exports.analyzeContext = async (req, res) => {
  res.status(501).json({ message: 'TODO: 맥락 분석/누락 정보 질문 생성 구현 필요 (FS-004)' });
};

exports.analyzeQuality = async (req, res) => {
  res.status(501).json({ message: 'TODO: 협업 적합도 분석 구현 필요 (FS-007)' });
};

exports.getOne = async (req, res) => {
  res.status(501).json({ message: 'TODO: 원문/변환문 비교 조회 구현 필요 (FS-008)' });
};

exports.saveRevision = async (req, res) => {
  res.status(501).json({ message: 'TODO: 사용자 최종 수정본 저장 구현 필요 (FS-008)' });
};
