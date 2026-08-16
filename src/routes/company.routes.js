const { Router } = require('express');
const companyController = require('../controllers/company.controller');

const router = Router();

router.get('/', companyController.getDna);
router.put('/', companyController.updateDna);
router.get('/list', companyController.list);
router.post('/list', companyController.create);
router.get('/:companyId/dna', companyController.getDna);
router.put('/:companyId/dna', companyController.updateDna);

module.exports = router;
