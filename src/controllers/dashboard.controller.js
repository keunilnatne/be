const dashboardService = require('../services/dashboardService');

exports.summary = async (req, res) => {
  res.json(await dashboardService.getSummary(req.user.id));
};
