const { Router } = require('express');
const authenticate = require('../middlewares/auth');
const dashboardController = require('../controllers/dashboard.controller');

const router = Router();

router.get('/summary', authenticate, dashboardController.getSummary);

module.exports = router;
