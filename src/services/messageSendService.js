const { Message, MessageResult } = require('../models');
const gmailService = require('./gmailService');
const ApiError = require('../utils/ApiError');

function overridesById(results) {
  if (results === undefined) return new Map();
  if (!Array.isArray(results)) throw ApiError.badRequest('results는 배열이어야 합니다.');
  if (results.length !== 1) {
    throw ApiError.badRequest('results에는 수신자별 결과 한 개만 지정해야 합니다.');
  }
  const entries = results.map((result) => {
    const id = Number(result.messageResultId ?? result.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw ApiError.badRequest('유효한 messageResultId가 필요합니다.');
    }
    return [id, result];
  });
  if (new Set(entries.map(([id]) => id)).size !== entries.length) {
    throw ApiError.badRequest('중복된 messageResultId가 있습니다.');
  }
  return new Map(entries);
}

async function sendWithRetry(sendMessage, input) {
  try {
    return await sendMessage(input);
  } catch (error) {
    const retryable = error.statusCode === 429 || error.statusCode >= 500;
    if (!retryable) throw error;
    return sendMessage(input);
  }
}

async function sendMany({ senderId, messageId, results }, dependencies = {}) {
  const findMessage = dependencies.findMessage || Message.findOne.bind(Message);
  const getAccessToken = dependencies.getAccessToken || gmailService.getAccessToken;
  const sendMessage = dependencies.sendMessage || gmailService.sendMessage;
  const message = await findMessage({
    where: { id: messageId, senderId },
    include: [{ model: MessageResult, as: 'results' }],
  });
  if (!message) throw ApiError.notFound('발송할 메시지를 찾을 수 없습니다.');

  const overrides = overridesById(results);
  const candidates = message.results.filter((result) =>
    (overrides.size === 0 || overrides.has(Number(result.id))) && result.status !== 'sent'
  );
  if (!candidates.length) throw ApiError.badRequest('발송할 수신자별 메시지가 없습니다.');
  if (candidates.length !== 1) {
    throw ApiError.badRequest('한 번에 한 명에게만 발송할 수 있습니다. messageResultId를 하나 선택해 주세요.');
  }
  if (overrides.size && candidates.length !== overrides.size) {
    throw ApiError.badRequest('선택한 결과가 메시지에 속하지 않거나 이미 발송되었습니다.');
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(senderId);
  } catch (error) {
    const failure = error.code === 'GMAIL_NOT_CONNECTED'
      ? error
      : ApiError.gmailNotConnected({ reason: 'TOKEN_ACQUISITION_FAILED' });
    await Promise.all(candidates.map((result) => result.update({
      status: 'failed',
      sentAt: null,
      errorMessage: failure.message,
    })));
    await message.update({ status: 'partially_failed' });
    throw failure;
  }
  const outcomes = [];
  for (const result of candidates) {
    const override = overrides.get(Number(result.id)) || {};
    const subject = String(override.subject ?? result.finalSubject ?? result.optimizedSubject ?? '').trim();
    const body = String(override.body ?? result.finalBody ?? result.optimizedBody ?? '').trim();
    const recipientEmail = String(result.recipientEmail || '').trim();

    const optimizationFailed = result.status === 'failed'
      && !result.optimizedSubject
      && !result.optimizedBody;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
      && !/[\r\n]/.test(recipientEmail);
    if (!validEmail || !subject || !body || optimizationFailed) {
      const errorMessage = optimizationFailed
        ? 'AI 최적화에 실패한 결과는 발송할 수 없습니다.'
        : '유효한 수신자 이메일, 제목 또는 본문이 없습니다.';
      await result.update({ status: 'failed', errorMessage });
      outcomes.push({ result, gmailMessageId: null, errorMessage });
      continue;
    }

    try {
      const sent = await sendWithRetry(sendMessage, {
        accessToken,
        to: recipientEmail,
        subject,
        body,
        attachments: override.attachments || [],
      });
      if (!sent?.id) throw ApiError.gmailSendFailed({ reason: 'MISSING_GMAIL_MESSAGE_ID' });
      await result.update({
        finalSubject: subject,
        finalBody: body,
        status: 'sent',
        sentAt: new Date(),
        errorMessage: null,
      });
      outcomes.push({ result, gmailMessageId: sent.id, errorMessage: null });
    } catch (error) {
      await result.update({
        finalSubject: subject,
        finalBody: body,
        status: 'failed',
        errorMessage: error.message,
      });
      outcomes.push({ result, gmailMessageId: null, errorMessage: error.message });
    }
  }

  const sentCount = outcomes.filter((outcome) => outcome.result.status === 'sent').length;
  await message.update({ status: sentCount === outcomes.length ? 'sent' : 'partially_failed' });
  return { message, outcomes, sentCount, failedCount: outcomes.length - sentCount };
}

module.exports = { overridesById, sendMany, sendWithRetry };
