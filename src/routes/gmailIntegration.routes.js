const { Router } = require('express');
const authenticate = require('../middlewares/authenticate');
const controller = require('../controllers/gmailIntegration.controller');

const router = Router();

router.get('/callback', controller.callback);
router.get('/connect', authenticate, controller.connect);
router.get('/status', authenticate, controller.status);
router.delete('/disconnect', authenticate, controller.disconnect);

module.exports = router;
