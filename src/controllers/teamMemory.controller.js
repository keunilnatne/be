const { TeamMemory } = require('../models');
const ApiError = require('../utils/ApiError');
const teamMemoryService = require('../services/teamMemoryService');

const initialPatterns = [
  {
    id: 1,
    team: 'default',
    type: 'pattern',
    title: '디자인 피드백 요청',
    purpose: '신규 UI 컴포넌트의 시각적 일관성 검토 및 브랜드 가이드 준수 확인',
    reason: '사용자 데이터 밀도 최적화를 위해 기존 카드 시스템의 패딩 값을 24px에서 16px로 축소함',
    request: '가독성 저하 여부 확인\n모바일 해상도 대응 확인',
    deadline: '',
    unread: true,
    status: 'approved',
  },
  {
    id: 2,
    team: 'default',
    type: 'pattern',
    title: '주간 보고 템플릿',
    purpose: '팀 내 성과 지표와 이슈 및 계획을 요약하는 정형화된 보고 체계입니다.',
    reason: '',
    request: '',
    deadline: '',
    unread: false,
    status: 'approved',
  },
  {
    id: 3,
    team: 'default',
    type: 'pattern',
    title: 'QA 버그 리포트',
    purpose: '재현 경로와 스크린샷 링크를 포함한 기술적 이슈 보고 형식입니다.',
    reason: '',
    request: '',
    deadline: '',
    unread: false,
    status: 'approved',
  },
];

const initialCandidates = [
  {
    id: 101,
    team: 'default',
    type: 'candidate',
    text: '"최근 5회 협업에서 동일한 표현이 반복되었습니다."',
    suggestion: '"문건에 대해 데이터 정합성 확인 부탁드립니다."',
    confidence: 94,
    status: 'pending',
  },
  {
    id: 102,
    team: 'default',
    type: 'candidate',
    text: '"확인 부탁드립니다" 표현이 반복적으로 사용되었습니다.',
    suggestion: '"확인 부탁드립니다"를 기본 표현으로 학습합니다.',
    confidence: 91,
    status: 'pending',
  },
  {
    id: 103,
    team: 'default',
    type: 'candidate',
    text: '보고 메시지에서 결론을 먼저 전달하는 패턴이 발견되었습니다.',
    suggestion: '결론 → 근거 → 요청 순서의 보고 패턴을 저장합니다.',
    confidence: 89,
    status: 'pending',
  },
];

const initialLogs = [
  {
    team: 'default',
    type: 'log',
    action: '패턴 학습 완료',
    description: '디자인 피드백 요청 패턴이 팀 메모리에 저장되었습니다.',
    status: 'approved',
  },
  {
    team: 'default',
    type: 'log',
    action: 'AI 패턴 감지',
    description: '협업 메시지에서 반복 표현이 감지되었습니다.',
    status: 'approved',
  },
  {
    team: 'default',
    type: 'log',
    action: '패턴 학습 완료',
    description: '주간 보고 템플릿 패턴이 팀 메모리에 저장되었습니다.',
    status: 'approved',
  },
];

const { Op } = require('sequelize');

function memoryWhere(req, extra = {}) {
  const userId = req.user?.id;
  if (userId) {
    return {
      ...extra,
      userId,
    };
  }
  return extra;
}

async function ensureSeedTeamMemory(userId) {
  if (!userId) return;
  const patternCount = await TeamMemory.count({ where: { userId, type: 'pattern' } });
  if (patternCount === 0) {
    const userPatterns = initialPatterns.map((p) => ({
      ...p,
      id: undefined,
      userId,
      team: `user-${userId}`,
    }));
    await TeamMemory.bulkCreate(userPatterns);
  }
}

function formatAgo(date) {
  if (!date) return '방금 전';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

function serializePattern(p) {
  return {
    id: String(p.id),
    title: p.title || '',
    purpose: p.purpose || '',
    reason: p.reason || '',
    request: p.request || '',
    deadline: p.deadline || '',
    attachmentName: p.attachmentName || undefined,
    updatedAt: formatAgo(p.updatedAt),
    unread: !!p.unread,
  };
}

function serializeCandidate(c) {
  return {
    id: String(c.id),
    text: c.text || '',
    suggestion: c.suggestion || '',
    confidence: c.confidence || 85,
  };
}

function serializeLog(l) {
  return {
    id: String(l.id),
    action: l.action || '패턴 학습 완료',
    description: l.description || '',
    time: formatAgo(l.createdAt),
  };
}

// GET /api/team-memory
exports.getOverview = async (req, res) => {
  const userId = req.user?.id;
  if (userId) await ensureSeedTeamMemory(userId);

  const patterns = await TeamMemory.findAll({
    where: memoryWhere(req, { type: 'pattern', status: 'approved' }),
    order: [['id', 'ASC']],
  });

  const candidates = await TeamMemory.findAll({
    where: memoryWhere(req, { type: 'candidate', status: 'pending' }),
    order: [['id', 'ASC']],
  });

  const logs = await TeamMemory.findAll({
    where: memoryWhere(req, { type: 'log' }),
    order: [['id', 'DESC']],
    limit: 10,
  });

  res.json({
    patterns: patterns.map(serializePattern),
    candidates: candidates.map(serializeCandidate),
    logs: logs.map(serializeLog),
  });
};

// GET /api/team-memory/patterns
exports.listPatterns = async (req, res) => {
  const userId = req.user?.id;
  if (userId) await ensureSeedTeamMemory(userId);
  const patterns = await TeamMemory.findAll({
    where: memoryWhere(req, { type: 'pattern', status: 'approved' }),
    order: [['id', 'ASC']],
  });
  res.json(patterns.map(serializePattern));
};

// GET /api/team-memory/candidates
exports.listCandidates = async (req, res) => {
  const userId = req.user?.id;
  if (userId) await ensureSeedTeamMemory(userId);
  const candidates = await TeamMemory.findAll({
    where: memoryWhere(req, { type: 'candidate', status: 'pending' }),
    order: [['id', 'ASC']],
  });
  res.json(candidates.map(serializeCandidate));
};

// GET /api/team-memory/logs
exports.listLogs = async (req, res) => {
  const userId = req.user?.id;
  if (userId) await ensureSeedTeamMemory(userId);
  const logs = await TeamMemory.findAll({
    where: memoryWhere(req, { type: 'log' }),
    order: [['id', 'DESC']],
    limit: 20,
  });
  res.json(logs.map(serializeLog));
};

// POST /api/team-memory/patterns
exports.createPattern = async (req, res) => {
  const { title, purpose, reason, request, deadline, attachmentName } = req.body;
  if (!title) {
    throw ApiError.badRequest('패턴 제목(title)은 필수입니다.');
  }

  const userId = req.user?.id || null;

  const pattern = await TeamMemory.create({
    userId,
    team: userId ? `user-${userId}` : 'default',
    type: 'pattern',
    title,
    purpose: purpose || '',
    reason: reason || '',
    request: request || '',
    deadline: deadline || '',
    attachmentName: attachmentName || null,
    unread: true,
    status: 'approved',
  });

  await TeamMemory.create({
    userId,
    team: userId ? `user-${userId}` : 'default',
    type: 'log',
    action: '일정 등록 완료',
    description: `'${title}' 일정이 새로 저장되었습니다.`,
    status: 'approved',
  });

  res.status(201).json(serializePattern(pattern));
};

exports.create = exports.createPattern;

// PUT /api/team-memory/patterns/:id
exports.updatePattern = async (req, res) => {
  const where = req.user?.id
    ? { id: req.params.id, userId: req.user.id }
    : { id: req.params.id };

  const pattern = await TeamMemory.findOne({ where });
  if (!pattern || pattern.type !== 'pattern') {
    throw ApiError.notFound('일정 또는 패턴을 찾을 수 없습니다.');
  }

  const { title, purpose, reason, request, deadline, attachmentName, unread } = req.body;

  await pattern.update({
    ...(title !== undefined && { title }),
    ...(purpose !== undefined && { purpose }),
    ...(reason !== undefined && { reason }),
    ...(request !== undefined && { request }),
    ...(deadline !== undefined && { deadline }),
    ...(attachmentName !== undefined && { attachmentName }),
    ...(unread !== undefined && { unread }),
  });

  await TeamMemory.create({
    userId: req.user?.id || null,
    team: req.user?.id ? `user-${req.user.id}` : 'default',
    type: 'log',
    action: '일정/패턴 업데이트',
    description: `'${pattern.title}' 내용이 업데이트되었습니다.`,
    status: 'approved',
  });

  res.json(serializePattern(pattern));
};

exports.update = exports.updatePattern;

// DELETE /api/team-memory/patterns/:id
exports.deletePattern = async (req, res) => {
  const where = req.user?.id
    ? { id: req.params.id, userId: req.user.id }
    : { id: req.params.id };

  const pattern = await TeamMemory.findOne({ where });
  if (!pattern || pattern.type !== 'pattern') {
    throw ApiError.notFound('일정 또는 패턴을 찾을 수 없습니다.');
  }

  const title = pattern.title;
  await pattern.destroy();

  await TeamMemory.create({
    userId: req.user?.id || null,
    team: req.user?.id ? `user-${req.user.id}` : 'default',
    type: 'log',
    action: '일정/패턴 삭제',
    description: `'${title}' 일정이 삭제되었습니다.`,
    status: 'approved',
  });

  res.json({ message: '일정이 성공적으로 삭제되었습니다.' });
};

exports.remove = exports.deletePattern;

// POST /api/team-memory/candidates/:id/approve - AI 추천 후보 승인
exports.approveCandidate = async (req, res) => {
  const candidate = await TeamMemory.findOne({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!candidate || candidate.type !== 'candidate') {
    throw ApiError.notFound('AI 추천 후보를 찾을 수 없습니다.');
  }

  await candidate.update({ status: 'approved' });

  // 새 패턴 등록
  const newPattern = await TeamMemory.create({
    userId: req.user.id,
    team: `user-${req.user.id}`,
    type: 'pattern',
    title: `AI 학습 패턴: ${(candidate.suggestion || candidate.title || '신규 패턴').slice(0, 15)}`,
    purpose: candidate.suggestion || candidate.purpose || '',
    reason: candidate.text || candidate.reason || '',
    unread: true,
    status: 'approved',
  });

  await TeamMemory.create({
    userId: req.user.id,
    team: `user-${req.user.id}`,
    type: 'log',
    action: '패턴 학습 완료',
    description: `AI 추천 패턴이 승인되어 팀 메모리에 학습되었습니다.`,
    status: 'approved',
  });

  res.json({
    message: 'AI 추천 패턴이 성공적으로 학습되었습니다.',
    pattern: serializePattern(newPattern),
  });
};

exports.approve = exports.approveCandidate;

// POST /api/team-memory/candidates/:id/reject - AI 추천 후보 거절
exports.rejectCandidate = async (req, res) => {
  const candidate = await TeamMemory.findOne({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!candidate || candidate.type !== 'candidate') {
    throw ApiError.notFound('AI 추천 후보를 찾을 수 없습니다.');
  }

  await candidate.update({ status: 'rejected' });

  await TeamMemory.create({
    userId: req.user.id,
    team: `user-${req.user.id}`,
    type: 'log',
    action: '패턴 거절',
    description: `AI 추천 패턴이 거절되었습니다.`,
    status: 'approved',
  });

  res.json({ message: 'AI 추천 패턴이 거절되었습니다.' });
};

exports.reject = exports.rejectCandidate;
exports.serialize = (memory) => (memory.type === 'candidate' ? serializeCandidate(memory) : memory.type === 'log' ? serializeLog(memory) : serializePattern(memory));
