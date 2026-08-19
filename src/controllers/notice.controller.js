const { Notice } = require('../models');
const ApiError = require('../utils/ApiError');

const DEFAULT_NOTICE = {
  title: '더 편리해진 이음을 만나보세요',
  subtitle: '성능 개선과 새로운 기능으로 더 나은 경험을 제공합니다.',
  tag: 'new',
  content: `• 실시간 비즈니스 메시지 AI 최적화 지원
• 조직 맞춤형 Company DNA 자동 분석 탑재
• 수신자별 맞춤형 문체 및 어조 조율 강화
• Gmail 실시간 수신함 연동 및 스마트 AI 일정 추출`,
};

exports.list = async (req, res) => {
  let list = await Notice.findAll({
    order: [['createdAt', 'DESC']],
  });

  // 공지가 하나도 없으면 기본 공지 자동 생성
  if (!list || list.length === 0) {
    const created = await Notice.create(DEFAULT_NOTICE);
    list = [created];
  }

  res.json(list);
};

exports.create = async (req, res) => {
  const { title, subtitle, content, tag } = req.body;

  if (!title || !title.trim()) {
    throw ApiError.badRequest('공지 제목을 입력해주세요.');
  }
  if (!content || !content.trim()) {
    throw ApiError.badRequest('공지 본문 내용을 입력해주세요.');
  }

  const notice = await Notice.create({
    title: title.trim(),
    subtitle: subtitle ? subtitle.trim() : null,
    content: content.trim(),
    tag: tag ? tag.trim() : 'new',
  });

  res.status(201).json(notice);
};

exports.delete = async (req, res) => {
  const { id } = req.params;
  const notice = await Notice.findByPk(id);
  if (!notice) {
    throw ApiError.notFound('공지사항을 찾을 수 없습니다.');
  }

  await notice.destroy();
  res.json({ success: true, message: '공지사항이 삭제되었습니다.' });
};
