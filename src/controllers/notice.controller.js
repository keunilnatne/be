const { Notice } = require('../models');
const ApiError = require('../utils/ApiError');

exports.list = async (req, res) => {
  const list = await Notice.findAll({
    order: [['createdAt', 'DESC']],
  });
  res.json(list);
};

exports.create = async (req, res) => {
  const { title, subtitle, content, tag } = req.body;

  if (!title || !title.trim()) {
    throw ApiError.badRequest('공지 제목을 입력해주세요.');
  }
  if (!content || !content.trim()) {
    throw ApiError.badRequest('공지 본문 내용을 입력해주세요.');
  }

  const notice = await Notice.create({
    title: title.trim(),
    subtitle: subtitle ? subtitle.trim() : null,
    content: content.trim(),
    tag: tag ? tag.trim() : 'new',
  });

  res.status(201).json(notice);
};

exports.delete = async (req, res) => {
  const { id } = req.params;
  const notice = await Notice.findByPk(id);
  if (!notice) {
    throw ApiError.notFound('공지사항을 찾을 수 없습니다.');
  }

  await notice.destroy();
  res.json({ success: true, message: '공지사항이 삭제되었습니다.' });
};
