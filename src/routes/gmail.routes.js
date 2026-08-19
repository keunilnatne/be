const { Router } = require('express');
const gmailController = require('../controllers/gmail.controller');
const authenticate = require('../middlewares/auth');

const router = Router();

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
};

router.get('/status', optionalAuth, gmailController.status);
router.get('/messages', optionalAuth, gmailController.listInbox);
router.get('/messages/:messageId', optionalAuth, gmailController.getMessage);
router.get('/messages/:messageId/attachments/:attachmentId', optionalAuth, gmailController.getAttachment);
router.post('/send', optionalAuth, gmailController.send);
router.post('/schedule/extract', optionalAuth, gmailController.extractSchedule);

module.exports = router;
