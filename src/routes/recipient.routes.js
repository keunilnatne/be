const { Router } = require('express');
const recipientController = require('../controllers/recipient.controller');

const router = Router();

router.get('/', recipientController.list);
router.post('/', recipientController.create);
router.get('/:recipientId', recipientController.getOne);
router.put('/:recipientId', recipientController.update);
router.patch('/:recipientId/favorite', recipientController.toggleFavorite);
router.delete('/:recipientId', recipientController.delete);

module.exports = router;
