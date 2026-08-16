const { Router } = require('express');
const authController = require('../controllers/auth.controller');

const authMiddleware = require('../middlewares/auth');

const router = Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.put('/password', authMiddleware, authController.changePassword);
router.get('/google', authController.googleAuthUrl);
router.get('/google/callback', authController.googleCallback);
router.get('/google/success', authController.googleSuccess);

module.exports = router;

