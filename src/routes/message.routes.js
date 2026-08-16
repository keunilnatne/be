const { Router } = require('express');
const messageController = require('../controllers/message.controller');
const authenticate = require('../middlewares/authenticate');

const router = Router();

router.post('/', messageController.createDraft);
router.post('/optimize', authenticate, messageController.optimize);
router.post('/send', authenticate, messageController.send);
// 태그 기반 변환 MVP 데모 엔드포인트 (body: { originalText, purpose, recipientId })
router.post('/convert', messageController.convert);
router.post('/:messageId/analyze-context', messageController.analyzeContext);
router.post('/:messageId/analyze-quality', messageController.analyzeQuality);
router.get('/:messageId', messageController.getOne);
router.post('/:messageId/revisions', messageController.saveRevision);

module.exports = router;
