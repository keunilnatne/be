const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const companyController = require('../controllers/company.controller');
const authMiddleware = require('../middlewares/auth');
const { requireCompanyAccess, requireRole } = require('../middlewares/authorize');

const router = Router();

// multer 설정 - 임시 디렉토리에 파일 저장
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다: ${ext} (지원: PDF, DOCX, TXT, MD)`));
    }
  },
});

// 기존 CRUD
router.use(authMiddleware);
router.get('/', companyController.getDna);
router.put('/', companyController.updateDna);
router.get('/list', requireRole('admin'), companyController.list);
router.post('/list', requireRole('admin'), companyController.create);
router.get('/:companyId/dna', requireCompanyAccess, companyController.getDna);
router.put('/:companyId/dna', requireCompanyAccess, companyController.updateDna);

// Company DNA 자동 추출
router.post('/extract/file', upload.single('file'), companyController.extractFromFile);
router.post('/extract/gmail', companyController.extractFromGmail);

module.exports = router;
