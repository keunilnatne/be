const { Router } = require('express');
const authenticate = require('../middlewares/authenticate');
const controller = require('../controllers/dashboard.controller');

const router = Router();
router.get('/summary', authenticate, controller.summary);

module.exports = router;
