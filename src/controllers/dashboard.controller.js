const dashboardService = require('../services/dashboardService');

exports.getSummary = async (req, res) => {
  const summary = await dashboardService.getSummary(req.user.id);
  res.json(summary);
};

exports.summary = exports.getSummary;
