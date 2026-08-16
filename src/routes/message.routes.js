const { Router } = require('express');
const messageController = require('../controllers/message.controller');

const router = Router();

// 프론트엔드 연동 신규 표준 엔드포인트
router.post('/optimize', messageController.optimize);
router.post('/send', messageController.send);

// 초안 및 단일 변환 엔드포인트
router.post('/', messageController.createDraft);
router.post('/convert', messageController.convert);
router.post('/:messageId/analyze-context', messageController.analyzeContext);
router.post('/:messageId/analyze-quality', messageController.analyzeQuality);
router.get('/:messageId', messageController.getOne);
router.post('/:messageId/revisions', messageController.saveRevision);

module.exports = router;
