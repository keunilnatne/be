const { Message, MessageResult, Recipient } = require('../models');
const ApiError = require('../utils/ApiError');

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
  {
    id: '3',
    date: '2026.08.21',
    recipient: '박준호',
    purpose: '백엔드 API 규격서 공유',
    score: 95,
    status: '전송 완료',
    type: '전송',
    originalSubject: 'API 규격서',
    originalBody: '규격서 공유합니다.',
    finalSubject: '[자료 공유] 신규 인증 API 인터페이스 명세서 공유',
    finalBody: '박준호 님, 최신 JWT 인증 규격서 문서를 첨부하여 전달해 드립니다.',
  },
  {
    id: '4',
    date: '2026.08.20',
    recipient: '최유리',
    purpose: '미팅 일정 조율',
    score: 90,
    status: '전송 완료',
    type: '전송',
    originalSubject: '미팅 일정',
    originalBody: '다음 주 미팅 가능한 시간 부탁드립니다.',
    finalSubject: '[일정 조율] 다음 주 사업 협력 미팅 일시 확인 요청',
    finalBody: '최유리 대표님, 다음 주 화요일 혹은 목요일 시간 가능 여부 확인 부탁드립니다.',
  },
];

function formatDate(date) {
  if (!date) return '2026.08.22';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

// GET /api/history
exports.listHistory = async (req, res) => {
  const { q, type } = req.query;

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

      if (type) {
        mapped = mapped.filter((m) => m.type === type);
      }

      return res.json(mapped);
    }
  } catch (e) {
    // fallback
  }

  res.json(fallbackHistory);
};

// GET /api/history/:id
exports.getHistoryDetail = async (req, res) => {
  const { id } = req.params;

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

  const found = fallbackHistory.find((item) => item.id === id) || fallbackHistory[0];
  res.json(found);
};
