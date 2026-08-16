const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = Router();

router.get('/summary', dashboardController.getSummary);

module.exports = router;
