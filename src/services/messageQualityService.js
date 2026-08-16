const { Message, MessageResult, MessageAnalysis } = require('../models');
const aiService = require('./aiService');
const ApiError = require('../utils/ApiError');

function selectedIds(resultIds) {
  if (resultIds === undefined) return null;
  if (!Array.isArray(resultIds) || !resultIds.length) {
    throw ApiError.badRequest('resultIds는 비어 있지 않은 배열이어야 합니다.');
  }
  const ids = [...new Set(resultIds.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw ApiError.badRequest('유효한 resultIds가 필요합니다.');
  }
  return new Set(ids);
}

async function analyze({ userId, messageId, resultIds }, dependencies = {}) {
  const findMessage = dependencies.findMessage || Message.findOne.bind(Message);
  const analyzeQuality = dependencies.analyzeQuality || aiService.analyzeQuality;
  const createAnalysis = dependencies.createAnalysis || MessageAnalysis.create.bind(MessageAnalysis);
  const message = await findMessage({
    where: { id: messageId, senderId: userId },
    include: [{ model: MessageResult, as: 'results' }],
  });
  if (!message) throw ApiError.notFound('분석할 메시지를 찾을 수 없습니다.');

  const ids = selectedIds(resultIds);
  const targets = message.results.filter((result) => !ids || ids.has(Number(result.id)));
  if (!targets.length || (ids && targets.length !== ids.size)) {
    throw ApiError.badRequest('선택한 수신자별 메시지 결과를 찾을 수 없습니다.');
  }

  const outcomes = [];
  for (const result of targets) {
    const subject = result.finalSubject || result.optimizedSubject;
    const body = result.finalBody || result.optimizedBody;
    if (!subject || !body) {
      outcomes.push({ result, analysis: null, error: '분석할 제목 또는 본문이 없습니다.' });
      continue;
    }
    try {
      const analysis = await analyzeQuality({
        subject,
        body,
        purpose: message.purpose,
        recipientContext: result.appliedContext?.recipient || result.appliedContext || {},
      });
      await result.update({
        qualityScore: analysis.overallScore,
        appliedContext: { ...(result.appliedContext || {}), qualityAnalysis: analysis },
      });
      outcomes.push({ result, analysis, error: null });
    } catch (error) {
      outcomes.push({ result, analysis: null, error: error.message });
    }
  }

  if (outcomes.some((outcome) => outcome.analysis)) {
    await createAnalysis({ messageId: message.id });
  }
  return outcomes;
}

module.exports = { selectedIds, analyze };
