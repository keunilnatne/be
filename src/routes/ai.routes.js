const { Router } = require('express');
const aiController = require('../controllers/ai.controller');
const authenticate = require('../middlewares/authenticate');

const router = Router();

router.use(authenticate);
router.post('/recipients/analyze', aiController.analyzeRecipient);
router.post('/messages/metadata', aiController.analyzeMessageMetadata);

module.exports = router;
