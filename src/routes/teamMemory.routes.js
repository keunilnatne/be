const { Router } = require('express');
const authenticate = require('../middlewares/authenticate');
const controller = require('../controllers/teamMemory.controller');

const router = Router();
router.use(authenticate);

router.get('/', controller.listPatterns);
router.post('/', controller.create);
router.get('/patterns', controller.listPatterns);
router.post('/patterns', controller.create);
router.put('/patterns/:id', controller.update);
router.delete('/patterns/:id', controller.remove);
router.get('/candidates', controller.listCandidates);
router.get('/logs', controller.listLogs);
router.post('/candidates/:id/approve', controller.approve);
router.post('/candidates/:id/reject', controller.reject);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
