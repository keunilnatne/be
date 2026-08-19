const { Router } = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const companyRoutes = require('./company.routes');
const recipientRoutes = require('./recipient.routes');
const messageRoutes = require('./message.routes');
const tagRoutes = require('./tag.routes');
const gmailRoutes = require('./gmail.routes');
const gmailIntegrationRoutes = require('./gmailIntegration.routes');
const teamMemoryRoutes = require('./teamMemory.routes');
const historyRoutes = require('./history.routes');
const dashboardRoutes = require('./dashboard.routes');
const conversationRoutes = require('./conversation.routes');
const noticeRoutes = require('./notice.routes');

const router = Router();

// FS-001: 사용자 인증 및 조직 프로필
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// FS-002: Company DNA
router.use('/companies', companyRoutes);
router.use('/company-dna', companyRoutes);

// FS-003: 수신자 협업 프로필
router.use('/recipients', recipientRoutes);

// FS-004~007: 메시지 생성, 분석 및 변환
router.use('/messages', messageRoutes);
router.use('/conversations', conversationRoutes);

// 직무, 문체, 조직 특성 태그 마스터
router.use('/tags', tagRoutes);

// FS-009: Gmail 연동
router.use('/gmail', gmailRoutes);
router.use('/integrations/gmail', gmailIntegrationRoutes);

// FS-010: 팀 메모리 (패턴 템플릿 및 학습 로그)
router.use('/team-memory', teamMemoryRoutes);

// FS-008: 히스토리 & 대시보드 통계 API
router.use('/history', historyRoutes);
router.use('/dashboard', dashboardRoutes);

// 공지사항 관리 API
router.use('/notices', noticeRoutes);

module.exports = router;

