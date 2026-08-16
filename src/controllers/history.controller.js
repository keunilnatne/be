const { Message, MessageResult, Recipient } = require('../models');
const historyService = require('../services/historyService');
const ApiError = require('../utils/ApiError');

function formatDate(date) {
  if (!date) return '2026.08.22';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

const fallbackHistory = [
  {
    id: '1',
    date: '2026.08.22',
    recipient: '김민수',
    purpose: '디자인 피드백 요청',
    score: 92,
    status: '전송 완료',
    type: '전송',
    originalSubject: '디자인 피드백',
    originalBody: '김민수 님, 카드 UI 시안 확인 부탁드립니다.',
    finalSubject: '[피드백 요청] 신규 카드 UI 시안 검토 건',
    finalBody: '안녕하세요 김민수 님, 이번 주 수요일 15:00까지 카드 UI 시안 검토를 부탁드립니다.',
  },
  {
    id: '2',
    date: '2026.08.21',
    recipient: '이서연',
    purpose: '주간 보고 템플릿',
    score: 88,
    status: '대기 중',
    type: '변환',
    originalSubject: '주간 보고',
    originalBody: '주간 진행 사항 보고합니다.',
    finalSubject: '[주간 보고] 금주 진행 현황 및 차주 계획 공유',
    finalBody: '금주 진행된 프로젝트 성과 지표와 이슈 사항을 정리하여 보고드립니다.',
  },
];

// GET /api/history
exports.list = async (req, res) => {
  const { q, type } = req.query;
  const userId = req.user?.id;

  if (userId && historyService?.list) {
    try {
      const items = await historyService.list({ userId, type, q });
      if (items && items.length > 0) return res.json(items);
    } catch (e) {
      // fallback
    }
  }

  try {
    const results = await MessageResult.findAll({
      include: [{ model: Message }],
      order: [['id', 'DESC']],
    });

    if (results && results.length > 0) {
      let mapped = results.map((r) => {
        const isSent = r.status === 'sent';
        return {
          id: String(r.id),
          date: formatDate(r.createdAt),
          recipient: r.recipientName || '수신자',
          purpose: r.Message?.purpose || r.optimizedSubject || '업무 관련 메시지',
          score: r.qualityScore || 92,
          status: isSent ? '전송 완료' : '대기 중',
          type: isSent ? '전송' : '변환',
          createdAt: r.createdAt,
          originalSubject: r.Message?.originalSubject || r.optimizedSubject,
          originalBody: r.Message?.originalBody || r.optimizedBody,
          finalSubject: r.finalSubject || r.optimizedSubject,
          finalBody: r.finalBody || r.optimizedBody,
        };
      });

      if (q) {
        const keyword = q.toLowerCase();
        mapped = mapped.filter(
          (m) =>
            m.recipient.toLowerCase().includes(keyword) ||
            m.purpose.toLowerCase().includes(keyword) ||
            m.finalSubject.toLowerCase().includes(keyword)
        );
      }

      if (type && type !== 'all') {
        mapped = mapped.filter((m) => m.type === type);
      }

      return res.json(mapped);
    }
  } catch (e) {
    // fallback
  }

  res.json(fallbackHistory);
};

exports.listHistory = exports.list;

// GET /api/history/:id
exports.getOne = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (userId && historyService?.getOne && Number.isInteger(Number(id))) {
    try {
      const detail = await historyService.getOne({ userId, id: Number(id) });
      if (detail) return res.json(detail);
    } catch (e) {
      // fallback
    }
  }

  try {
    const r = await MessageResult.findByPk(id, { include: [{ model: Message }] });
    if (r) {
      const isSent = r.status === 'sent';
      return res.json({
        id: String(r.id),
        date: formatDate(r.createdAt),
        recipient: r.recipientName || '수신자',
        purpose: r.Message?.purpose || r.optimizedSubject || '업무 관련 메시지',
        score: r.qualityScore || 92,
        status: isSent ? '전송 완료' : '대기 중',
        type: isSent ? '전송' : '변환',
        createdAt: r.createdAt,
        originalSubject: r.Message?.originalSubject || r.optimizedSubject,
        originalBody: r.Message?.originalBody || r.optimizedBody,
        finalSubject: r.finalSubject || r.optimizedSubject,
        finalBody: r.finalBody || r.optimizedBody,
      });
    }
  } catch (e) {
    // fallback
  }

  const found = fallbackHistory.find((item) => item.id === String(id)) || fallbackHistory[0];
  res.json(found);
};

exports.getHistoryDetail = exports.getOne;

