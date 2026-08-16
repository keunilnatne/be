const { Message, MessageResult } = require('../models');
const ApiError = require('../utils/ApiError');

function historyType(result) {
  return result.status === 'sent' || result.finalSubject || result.finalBody ? '전송' : '변환';
}

function displayStatus(result) {
  if (result.status === 'sent') return '전송 완료';
  if (result.status === 'failed') return '실패';
  return '대기 중';
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10).replaceAll('-', '.');
}

function serialize(message, result) {
  return {
    id: String(result.id),
    messageId: String(message.id),
    date: formatDate(result.sentAt || result.createdAt || message.createdAt),
    recipient: result.recipientName || result.recipientEmail || '알 수 없음',
    recipientEmail: result.recipientEmail || null,
    purpose: message.purpose || message.originalSubject || '',
    score: Number(result.qualityScore || 0),
    status: displayStatus(result),
    type: historyType(result),
    subject: result.finalSubject || result.optimizedSubject || message.originalSubject || '',
    content: result.finalBody || result.optimizedBody || message.originalBody || '',
    originalSubject: message.originalSubject || '',
    originalBody: message.originalBody || '',
    error: result.errorMessage || null,
    createdAt: result.createdAt || message.createdAt,
    sentAt: result.sentAt || null,
  };
}

function matchesType(result, type) {
  if (!type || type === 'all') return true;
  if (type === 'sent') return historyType(result) === '전송';
  if (type === 'converted') return historyType(result) === '변환';
  throw ApiError.badRequest('type은 all, converted, sent 중 하나여야 합니다.');
}

async function list({ userId, type, q }, dependencies = {}) {
  const findMessages = dependencies.findMessages || Message.findAll.bind(Message);
  const messages = await findMessages({
    where: { senderId: userId },
    include: [{ model: MessageResult, as: 'results', required: false }],
    order: [['createdAt', 'DESC'], [{ model: MessageResult, as: 'results' }, 'createdAt', 'DESC']],
  });
  const keyword = String(q || '').trim().toLowerCase();
  return messages.flatMap((message) => message.results
    .filter((result) => matchesType(result, type))
    .map((result) => serialize(message, result)))
    .filter((item) => !keyword || [
      item.recipient,
      item.recipientEmail,
      item.purpose,
      item.subject,
      item.content,
      item.status,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)));
}

async function getOne({ userId, id }, dependencies = {}) {
  const findResult = dependencies.findResult || MessageResult.findOne.bind(MessageResult);
  const result = await findResult({
    where: { id },
    include: [{ model: Message, where: { senderId: userId }, required: true }],
  });
  if (!result) throw ApiError.notFound('기록을 찾을 수 없습니다.');
  return serialize(result.Message, result);
}

module.exports = { displayStatus, historyType, serialize, list, getOne };
