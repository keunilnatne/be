const { Router } = require('express');
const gmailController = require('../controllers/gmail.controller');
const authenticate = require('../middlewares/auth');

const router = Router();

router.use(authenticate);

router.get('/status', gmailController.status);
router.get('/messages', gmailController.listInbox);
router.get('/messages/:messageId', gmailController.getMessage);
router.get('/messages/:messageId/attachments/:attachmentId', gmailController.getAttachment);
router.post('/send', gmailController.send);
router.post('/schedule/extract', gmailController.extractSchedule);

module.exports = router;
