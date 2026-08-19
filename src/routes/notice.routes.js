const { Router } = require('express');
const noticeController = require('../controllers/notice.controller');
const authenticate = require('../middlewares/authenticate');
const { requireAdmin } = require('../middlewares/authorize');

const router = Router();

router.use(authenticate);

// 공지사항 목록 조회 (공개)
router.get('/', noticeController.list);

// 공지사항 작성
router.post('/', requireAdmin, noticeController.create);

// 공지사항 삭제
router.delete('/:id', requireAdmin, noticeController.delete);

module.exports = router;
