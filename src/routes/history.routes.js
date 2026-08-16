const { Router } = require('express');
const historyController = require('../controllers/history.controller');

const router = Router();

router.get('/', historyController.listHistory);
router.get('/:id', historyController.getHistoryDetail);

module.exports = router;
