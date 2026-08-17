const historyService = require('../services/historyService');
const ApiError = require('../utils/ApiError');

// GET /api/history
exports.list = async (req, res) => {
  const items = await historyService.list({
    userId: req.user.id,
    type: req.query.type,
    q: req.query.q,
  });
  res.json(items);
};

exports.listHistory = exports.list;

// GET /api/history/:id
exports.getOne = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('유효한 이력 ID가 필요합니다.');
  }

  const detail = await historyService.getOne({ userId: req.user.id, id });
  res.json(detail);
};

exports.getHistoryDetail = exports.getOne;
