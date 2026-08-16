const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate');

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, userController.updateMe);
router.get('/', userController.list);
router.post('/', userController.create);
router.get('/:userId', userController.getOne);
router.put('/:userId', userController.update);

module.exports = router;
