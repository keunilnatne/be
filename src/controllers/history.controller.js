const historyService = require('../services/historyService');
const ApiError = require('../utils/ApiError');

exports.list = async (req, res) => {
  res.json(await historyService.list({
    userId: req.user.id,
    type: req.query.type,
    q: req.query.q,
  }));
};

exports.getOne = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('유효한 기록 ID가 필요합니다.');
  res.json(await historyService.getOne({ userId: req.user.id, id }));
};
