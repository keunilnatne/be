const { Router } = require('express');
const userController = require('../controllers/user.controller');

const router = Router();

router.get('/', userController.list);
router.post('/', userController.create);
router.get('/:userId', userController.getOne);
router.put('/:userId', userController.update);

module.exports = router;
