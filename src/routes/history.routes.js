const { Router } = require('express');
const authenticate = require('../middlewares/auth');
const historyController = require('../controllers/history.controller');

const router = Router();

router.get('/', authenticate, historyController.list);
router.get('/:id', authenticate, historyController.getOne);

module.exports = router;
