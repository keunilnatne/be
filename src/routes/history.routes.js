const { Router } = require('express');
const authenticate = require('../middlewares/authenticate');
const controller = require('../controllers/history.controller');

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.get('/:id', controller.getOne);

module.exports = router;
