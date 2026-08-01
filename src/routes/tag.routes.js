const { Router } = require('express');
const tagController = require('../controllers/tag.controller');

const router = Router();

router.get('/', tagController.list);
router.post('/attach', tagController.attachToEntity);
router.delete('/attach', tagController.detachFromEntity);
router.get('/entity/:entityType/:entityId', tagController.getForEntity);
router.post('/infer', tagController.inferForEntity);

module.exports = router;
