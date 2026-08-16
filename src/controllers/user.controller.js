const { User, Company } = require('../models');
const tagService = require('../services/tagService');
const ApiError = require('../utils/ApiError');
const serializeUser = require('../utils/serializeUser');

const PROFILE_FIELDS = [
  'name',
  'jobRole',
  'position',
  'team',
  'defaultLanguage',
  'tools',
  'communicationPreferences',
  'customStyle',
  'companyId',
];

function pickProfileFields(body) {
  return PROFILE_FIELDS.reduce((values, field) => {
    if (body[field] !== undefined) values[field] = body[field];
    return values;
  }, {});
}

async function validateProfileUpdates(updates) {
  if (updates.name !== undefined && !String(updates.name).trim()) {
    throw ApiError.badRequest('name은 빈 값일 수 없습니다.');
  }
  if (updates.tools !== undefined && !Array.isArray(updates.tools)) {
    throw ApiError.badRequest('tools는 배열이어야 합니다.');
  }
  if (
    updates.communicationPreferences !== undefined
    && !Array.isArray(updates.communicationPreferences)
  ) {
    throw ApiError.badRequest('communicationPreferences는 배열이어야 합니다.');
  }
  if (updates.companyId !== undefined && updates.companyId !== null) {
    const company = await Company.findByPk(updates.companyId);
    if (!company) throw ApiError.badRequest('존재하지 않는 회사입니다.');
  }
  if (updates.name !== undefined) updates.name = String(updates.name).trim();
}

exports.list = async (req, res) => {
  const users = await User.findAll({ include: [Company] });
  res.json(await Promise.all(users.map(serializeUser)));
};

exports.create = async (req, res) => {
  const { name, email, jobRole, team, companyId, tagIds } = req.body;
  if (!name || !email) {
    throw ApiError.badRequest('name, email은 필수입니다.');
  }

  const user = await User.create({ name, email, jobRole, team, companyId: companyId || null });

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

  const { name, email, jobRole, team, companyId, tagIds } = req.body;
  await user.update({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(jobRole !== undefined && { jobRole }),
    ...(team !== undefined && { team }),
    ...(companyId !== undefined && { companyId }),
  });

  if (Array.isArray(tagIds)) {
    await tagService.setTagsForEntity('user', user.id, tagIds);
  }

  const updated = await User.findByPk(user.id, { include: [Company] });
  res.json(await serializeUser(updated));
};

exports.getMe = async (req, res) => {
  const user = await User.findByPk(req.user.id, { include: [Company] });
  res.json(await serializeUser(user));
};

exports.updateMe = async (req, res) => {
  const updates = pickProfileFields(req.body);
  await validateProfileUpdates(updates);
  await req.user.update(updates);

  if (Array.isArray(req.body.tagIds)) {
    await tagService.setTagsForEntity('user', req.user.id, req.body.tagIds);
  }

  const updated = await User.findByPk(req.user.id, { include: [Company] });
  res.json(await serializeUser(updated));
};
