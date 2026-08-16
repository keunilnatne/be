const { Router } = require('express');
const authenticate = require('../middlewares/auth');
const historyController = require('../controllers/history.controller');

const router = Router();

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
};

router.get('/', optionalAuth, historyController.list);
router.get('/:id', optionalAuth, historyController.getOne);

module.exports = router;

