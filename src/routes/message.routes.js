const { Router } = require('express');
const messageController = require('../controllers/message.controller');
const authenticate = require('../middlewares/auth');

const router = Router();

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
};

// 다중 수신자 AI 최적화 및 발송
router.post('/optimize', authenticate, messageController.optimizeAuthenticated);
router.post('/send', authenticate, messageController.sendAuthenticated);

// 초안 및 단일 변환 엔드포인트
router.post('/', optionalAuth, messageController.createDraft);
router.post('/convert', optionalAuth, messageController.convert);
router.post('/:messageId/analyze-context', optionalAuth, messageController.analyzeContext);
router.post('/:messageId/analyze-quality', optionalAuth, messageController.analyzeQuality);
router.get('/:messageId', optionalAuth, messageController.getOne);
router.post('/:messageId/revisions', optionalAuth, messageController.saveRevision);

module.exports = router;
