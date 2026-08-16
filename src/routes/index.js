const { Router } = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const companyRoutes = require('./company.routes');
const recipientRoutes = require('./recipient.routes');
const messageRoutes = require('./message.routes');
const tagRoutes = require('./tag.routes');
const teamMemoryRoutes = require('./teamMemory.routes');

const router = Router();

// FS-001: 사용자 인증 및 조직 프로필
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// FS-002: Company DNA
router.use('/companies', companyRoutes);

// FS-003: 수신자 협업 프로필
router.use('/recipients', recipientRoutes);

// FS-004~007: 메시지 생성, 분석 및 변환
router.use('/messages', messageRoutes);

// 직무, 문체, 조직 특성 태그 마스터
router.use('/tags', tagRoutes);
router.use('/team-memory', teamMemoryRoutes);

module.exports = router;
