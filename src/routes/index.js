const { Router } = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const companyRoutes = require('./company.routes');
const recipientRoutes = require('./recipient.routes');
const messageRoutes = require('./message.routes');
const tagRoutes = require('./tag.routes');
const gmailRoutes = require('./gmail.routes');

const router = Router();

// FS-001: 사용자/조직 프로필
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// FS-002: Company DNA
router.use('/companies', companyRoutes);
router.use('/company-dna', companyRoutes);

// FS-003: 수신자 협업 프로필
router.use('/recipients', recipientRoutes);

// FS-004~007: 메시지 생성/분석/변환
router.use('/messages', messageRoutes);

// 태그 마스터 (직무/문체/조직 특성 등)
router.use('/tags', tagRoutes);

// FS-009: Gmail 연동 (받은 편지함 조회, 발송)
router.use('/gmail', gmailRoutes);

module.exports = router;
