const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth');

const router = Router();

// /me 라우트는 인증이 필요함
router.get('/me', authMiddleware, userController.getMe);
router.put('/me', authMiddleware, userController.updateMe);
router.patch('/me', authMiddleware, userController.updateMe);
router.delete('/me', authMiddleware, userController.deleteMe);
router.patch('/me/onboarding', authMiddleware, userController.completeOnboarding);
router.get('/me/ai-settings', authMiddleware, userController.getAiSettings);
router.put('/me/ai-settings', authMiddleware, userController.updateAiSettings);
router.post('/me/reset-personalization', authMiddleware, userController.resetPersonalization);
router.get('/lookup', authMiddleware, userController.lookupByEmail);

router.get('/', userController.list);
router.post('/', userController.create);
router.get('/:userId', userController.getOne);
router.put('/:userId', userController.update);

module.exports = router;

