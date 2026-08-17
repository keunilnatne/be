const { Message, MessageResult } = require('../models');
const ApiError = require('../utils/ApiError');

// GET /api/conversations - 사용자의 대화/메시지 내역 조회
exports.list = async (req, res) => {
  const userId = req.user.id;
  const messages = await Message.findAll({
    where: { senderId: userId },
    include: [{ model: MessageResult, as: 'results', required: false }],
    order: [['updatedAt', 'DESC']],
  });

  const conversations = messages.map((msg) => {
    const firstResult = msg.results?.[0];
    const msgs = [];
    if (msg.originalBody) {
      msgs.push({
        role: 'user',
        content: msg.originalBody,
        createdAt: msg.createdAt,
      });
    }
    if (firstResult?.optimizedBody) {
      msgs.push({
        role: 'assistant',
        content: firstResult.optimizedBody,
        createdAt: firstResult.createdAt || msg.updatedAt,
      });
    }

    return {
      id: String(msg.id),
      title: msg.originalSubject || msg.purpose || '새로운 메시지',
      subject: msg.originalSubject || '',
      body: msg.originalBody || '',
      recipientName: firstResult?.recipientName || '',
      recipientEmail: firstResult?.recipientEmail || '',
      updatedAt: (msg.updatedAt || msg.createdAt).toISOString(),
      messages: msgs,
      status: msg.status,
      analysisStatus: msg.status === 'sent' || msg.status === 'converted' ? 'completed' : 'pending',
      styleAnalysis: {
        tone: '비즈니스 맞춤형',
        writingStyle: '간결하고 명확함',
        informationOrder: '핵심 정보 우선',
        detailLevel: '보통',
        confidence: firstResult?.qualityScore ? Number(firstResult.qualityScore) : 92,
      },
    };
  });

  res.json(conversations);
};

// GET /api/conversations/:id
exports.getOne = async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  if (!id) throw ApiError.badRequest('유효한 대화 ID가 필요합니다.');

  const msg = await Message.findOne({
    where: { id, senderId: userId },
    include: [{ model: MessageResult, as: 'results', required: false }],
  });
  if (!msg) throw ApiError.notFound('대화 내역을 찾을 수 없습니다.');

  const firstResult = msg.results?.[0];
  const msgs = [];
  if (msg.originalBody) {
    msgs.push({ role: 'user', content: msg.originalBody, createdAt: msg.createdAt });
  }
  if (firstResult?.optimizedBody) {
    msgs.push({ role: 'assistant', content: firstResult.optimizedBody, createdAt: firstResult.createdAt });
  }

  res.json({
    id: String(msg.id),
    title: msg.originalSubject || msg.purpose || '새로운 메시지',
    subject: msg.originalSubject || '',
    body: msg.originalBody || '',
    recipientName: firstResult?.recipientName || '',
    recipientEmail: firstResult?.recipientEmail || '',
    updatedAt: (msg.updatedAt || msg.createdAt).toISOString(),
    messages: msgs,
    status: msg.status,
    analysisStatus: msg.status === 'sent' || msg.status === 'converted' ? 'completed' : 'pending',
    styleAnalysis: {
      tone: '비즈니스 맞춤형',
      writingStyle: '간결하고 명확함',
      informationOrder: '핵심 정보 우선',
      detailLevel: '보통',
      confidence: firstResult?.qualityScore ? Number(firstResult.qualityScore) : 92,
    },
  });
};

// DELETE /api/conversations/:id
exports.delete = async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  if (!id) throw ApiError.badRequest('유효한 대화 ID가 필요합니다.');

  const msg = await Message.findOne({ where: { id, senderId: userId } });
  if (!msg) throw ApiError.notFound('대화 내역을 찾을 수 없습니다.');

  await MessageResult.destroy({ where: { messageId: id } });
  await msg.destroy();
  res.json({ message: '대화가 성공적으로 삭제되었습니다.' });
};
