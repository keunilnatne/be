const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const companyController = require('../controllers/company.controller');
const authMiddleware = require('../middlewares/auth');

const router = Router();

// multer 설정 - 임시 디렉토리에 파일 저장
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization || req.get('authorization')) {
    return authMiddleware(req, res, next);
  }
  next();
};

// 기존 CRUD
router.get('/', optionalAuth, companyController.getDna);
router.put('/', optionalAuth, companyController.updateDna);
router.get('/list', companyController.list);
router.post('/list', companyController.create);
router.get('/:companyId/dna', optionalAuth, companyController.getDna);
router.put('/:companyId/dna', optionalAuth, companyController.updateDna);

// Company DNA 자동 추출
router.post('/extract/file', upload.single('file'), companyController.extractFromFile);
router.post('/extract/gmail', authMiddleware, companyController.extractFromGmail);

module.exports = router;
