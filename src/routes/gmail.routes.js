const { Router } = require('express');
const gmailController = require('../controllers/gmail.controller');

const router = Router();

router.get('/status', gmailController.status);
router.get('/messages', gmailController.listInbox);
router.get('/messages/:messageId', gmailController.getMessage);
router.post('/send', gmailController.send);

module.exports = router;
