const { Router } = require('express');
const conversationController = require('../controllers/conversation.controller');
const authenticate = require('../middlewares/auth');

const router = Router();

router.use(authenticate);

router.get('/', conversationController.list);
router.get('/:id', conversationController.getOne);
router.delete('/:id', conversationController.delete);

module.exports = router;
