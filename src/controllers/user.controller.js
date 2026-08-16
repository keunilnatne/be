const { User, Company, UserSetting } = require('../models');
const tagService = require('../services/tagService');
const ApiError = require('../utils/ApiError');

async function serializeUser(user) {
  const tags = await tagService.getTagsForEntity('user', user.id);
  let setting = await UserSetting.findOne({ where: { userId: user.id } });
  if (!setting) {
    setting = await UserSetting.create({ userId: user.id });
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobRole: user.jobRole || '',
    jobTitle: user.jobTitle || '',
    team: user.team || '',
    companyId: user.companyId || null,
    companyName: user.companyName || '',
    tools: user.tools || ['Slack', 'Notion', 'Gmail'],
    preferredStyle: user.preferredStyle || '명확한 표현 선호',
    customStyle: user.customStyle || '',
    defaultLanguage: user.defaultLanguage || 'Korean',
    timezone: user.timezone || 'Asia/Seoul',
    googleConnected: !!user.googleConnected,
    googleEmail: user.googleEmail || '',
    company: user.Company ? { id: user.Company.id, name: user.Company.name } : null,
    setting: {
      tone: setting.tone,
      formality: setting.formality,
      length: setting.length,
      aiAutoSuggestion: setting.aiAutoSuggestion,
      dataRetentionDays: setting.dataRetentionDays,
    },
    tags: tags.map((t) => ({ id: t.id, category: t.category, name: t.name, label: t.label })),
  };
}

exports.list = async (req, res) => {
  const users = await User.findAll({ include: [Company] });
  res.json(await Promise.all(users.map(serializeUser)));
};

exports.create = async (req, res) => {
  const { name, email, jobRole, team, companyId, timezone, tagIds } = req.body;
  if (!name || !email) {
    throw ApiError.badRequest('name, email은 필수입니다.');
  }

  const user = await User.create({
    name,
    email,
    jobRole,
    team,
    companyId: companyId || null,
    ...(timezone && { timezone }),
  });

  if (Array.isArray(tagIds) && tagIds.length) {
    await tagService.setTagsForEntity('user', user.id, tagIds);
  }

  const created = await User.findByPk(user.id, { include: [Company] });
  res.status(201).json(await serializeUser(created));
};

exports.getOne = async (req, res) => {
  const user = await User.findByPk(req.params.userId, { include: [Company] });
  if (!user) throw ApiError.notFound('사용자를 찾을 수 없습니다.');
  res.json(await serializeUser(user));
};

exports.update = async (req, res) => {
  const user = await User.findByPk(req.params.userId);
  if (!user) throw ApiError.notFound('사용자를 찾을 수 없습니다.');

  const { name, email, jobRole, jobTitle, team, companyId, companyName, tools, preferredStyle, customStyle, defaultLanguage, timezone, tagIds } = req.body;
  await user.update({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(jobRole !== undefined && { jobRole }),
    ...(jobTitle !== undefined && { jobTitle }),
    ...(team !== undefined && { team }),
    ...(companyId !== undefined && { companyId }),
    ...(companyName !== undefined && { companyName }),
    ...(tools !== undefined && { tools }),
    ...(preferredStyle !== undefined && { preferredStyle }),
    ...(customStyle !== undefined && { customStyle }),
    ...(defaultLanguage !== undefined && { defaultLanguage }),
    ...(timezone !== undefined && { timezone }),
  });

  if (Array.isArray(tagIds)) {
    await tagService.setTagsForEntity('user', user.id, tagIds);
  }

  const updated = await User.findByPk(user.id, { include: [Company] });
  res.json(await serializeUser(updated));
};

// GET /api/users/me
exports.getMe = async (req, res) => {
  const user = await User.findByPk(req.user.id, { include: [Company] });
  res.json(await serializeUser(user));
};

// PUT /api/users/me
exports.updateMe = async (req, res) => {
  const user = req.user;
  const { name, jobRole, jobTitle, team, companyName, tools, preferredStyle, customStyle, defaultLanguage, timezone } = req.body;

  await user.update({
    ...(name !== undefined && { name }),
    ...(jobRole !== undefined && { jobRole }),
    ...(jobTitle !== undefined && { jobTitle }),
    ...(team !== undefined && { team }),
    ...(companyName !== undefined && { companyName }),
    ...(tools !== undefined && { tools }),
    ...(preferredStyle !== undefined && { preferredStyle }),
    ...(customStyle !== undefined && { customStyle }),
    ...(defaultLanguage !== undefined && { defaultLanguage }),
    ...(timezone !== undefined && { timezone }),
  });

  const updated = await User.findByPk(user.id, { include: [Company] });
  res.json(await serializeUser(updated));
};

// GET /api/users/me/ai-settings
exports.getAiSettings = async (req, res) => {
  let setting = await UserSetting.findOne({ where: { userId: req.user.id } });
  if (!setting) {
    setting = await UserSetting.create({ userId: req.user.id });
  }
  res.json(setting);
};

// PUT /api/users/me/ai-settings
exports.updateAiSettings = async (req, res) => {
  let setting = await UserSetting.findOne({ where: { userId: req.user.id } });
  if (!setting) {
    setting = await UserSetting.create({ userId: req.user.id });
  }

  const { tone, formality, length, aiAutoSuggestion, dataRetentionDays } = req.body;
  await setting.update({
    ...(tone !== undefined && { tone }),
    ...(formality !== undefined && { formality }),
    ...(length !== undefined && { length }),
    ...(aiAutoSuggestion !== undefined && { aiAutoSuggestion }),
    ...(dataRetentionDays !== undefined && { dataRetentionDays }),
  });

  res.json(setting);
};

// POST /api/users/me/reset-personalization
exports.resetPersonalization = async (req, res) => {
  let setting = await UserSetting.findOne({ where: { userId: req.user.id } });
  if (setting) {
    await setting.update({
      tone: '정중하고 명확한 문체',
      formality: '중립적',
      length: '요약 위주',
      aiAutoSuggestion: true,
      dataRetentionDays: 90,
    });
  }
  res.json({ message: '개인화 설정이 초기화되었습니다.' });
};

// DELETE /api/users/me
exports.deleteMe = async (req, res) => {
  const user = req.user;
  await UserSetting.destroy({ where: { userId: user.id } });
  await user.destroy();
  res.json({ message: '계정이 삭제되었습니다.' });
};
