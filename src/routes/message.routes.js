const { Router } = require('express');
const messageController = require('../controllers/message.controller');
const authenticate = require('../middlewares/auth');

const router = Router();

// 다중 수신자 AI 최적화 및 발송
router.post('/optimize', authenticate, messageController.optimizeAuthenticated);
router.post('/send', authenticate, messageController.sendAuthenticated);

// 임시 저장함 (Drafts)
router.get('/drafts', authenticate, messageController.listDrafts);
router.post('/drafts', authenticate, messageController.saveDraft);
router.delete('/drafts/:draftId', authenticate, messageController.deleteDraft);

// 초안 및 단일 변환 엔드포인트
router.post('/', authenticate, messageController.saveDraft);
router.post('/convert', authenticate, messageController.convert);
router.post('/:messageId/analyze-context', authenticate, messageController.analyzeContext);
router.post('/:messageId/analyze-quality', authenticate, messageController.analyzeQuality);
router.get('/:messageId', authenticate, messageController.getOne);
router.post('/:messageId/revisions', authenticate, messageController.saveRevision);

module.exports = router;
