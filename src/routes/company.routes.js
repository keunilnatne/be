const { Router } = require('express');
const companyController = require('../controllers/company.controller');

const router = Router();

router.get('/', companyController.list);
router.post('/', companyController.create);
router.get('/:companyId/dna', companyController.getDna);
router.put('/:companyId/dna', companyController.updateDna);

module.exports = router;
