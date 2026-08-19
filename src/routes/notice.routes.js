const { Router } = require('express');
const noticeController = require('../controllers/notice.controller');
const authenticate = require('../middlewares/authenticate');

const router = Router();

router.use(authenticate);

// 공지사항 목록 조회 (공개)
router.get('/', noticeController.list);

// 공지사항 작성
router.post('/', noticeController.create);

// 공지사항 삭제
router.delete('/:id', noticeController.delete);

module.exports = router;
