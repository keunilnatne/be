const { Router } = require('express');
const teamMemoryController = require('../controllers/teamMemory.controller');

const router = Router();

// 팀 메모리 전체 개요 (패턴 + AI 추천 후보 + 학습 로그)
router.get('/', teamMemoryController.getOverview);

// 패턴 CRUD
router.get('/patterns', teamMemoryController.listPatterns);
router.post('/patterns', teamMemoryController.createPattern);
router.put('/patterns/:id', teamMemoryController.updatePattern);
router.delete('/patterns/:id', teamMemoryController.deletePattern);

// AI 추천 후보 승인 & 거절
router.post('/candidates/:id/approve', teamMemoryController.approveCandidate);
router.post('/candidates/:id/reject', teamMemoryController.rejectCandidate);

module.exports = router;
