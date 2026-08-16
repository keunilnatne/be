const { Router } = require('express');
const authenticate = require('../middlewares/auth');
const teamMemoryController = require('../controllers/teamMemory.controller');

const router = Router();

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
};

router.use(optionalAuth);

// 팀 메모리 전체 개요 (패턴 + AI 추천 후보 + 학습 로그)
router.get('/', (req, res, next) => {
  if (req.query.type === 'pattern' || req.query.q) {
    return teamMemoryController.listPatterns(req, res, next);
  }
  return teamMemoryController.getOverview(req, res, next);
});

router.post('/', teamMemoryController.createPattern);

// 패턴 CRUD
router.get('/patterns', teamMemoryController.listPatterns);
router.post('/patterns', teamMemoryController.createPattern);
router.put('/patterns/:id', teamMemoryController.updatePattern);
router.delete('/patterns/:id', teamMemoryController.deletePattern);

// AI 추천 후보 & 로그
router.get('/candidates', teamMemoryController.listCandidates);
router.get('/logs', teamMemoryController.listLogs);
router.post('/candidates/:id/approve', teamMemoryController.approveCandidate);
router.post('/candidates/:id/reject', teamMemoryController.rejectCandidate);

router.put('/:id', teamMemoryController.updatePattern);
router.delete('/:id', teamMemoryController.deletePattern);

module.exports = router;

