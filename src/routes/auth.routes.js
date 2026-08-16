const { Router } = require('express');
const authController = require('../controllers/auth.controller');

const authMiddleware = require('../middlewares/auth');

const router = Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.put('/password', authMiddleware, authController.changePassword);
router.get('/google', authController.googleAuthUrl);
router.get('/google/callback', authController.googleCallback);

module.exports = router;
