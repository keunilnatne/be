const { Router } = require('express');
const authenticate = require('../middlewares/auth');
const dashboardController = require('../controllers/dashboard.controller');

const router = Router();

router.get('/summary', (req, res, next) => {
  // Optional auth: if Bearer token present, authenticate, otherwise proceed
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, dashboardController.getSummary);

module.exports = router;

