const { User, Company } = require('../models');
const tagService = require('../services/tagService');
const ApiError = require('../utils/ApiError');

// FS-001: 사용자 및 조직 프로필 설정 (MVP: 로그인 없이 CRUD, 태그로 기본 문체 표현)
async function serializeUser(user) {
  const tags = await tagService.getTagsForEntity('user', user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobRole: user.jobRole,
    team: user.team,
    timezone: user.timezone,
    company: user.Company ? { id: user.Company.id, name: user.Company.name } : null,
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

  const { name, email, jobRole, team, companyId, timezone, tagIds } = req.body;
  await user.update({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(jobRole !== undefined && { jobRole }),
    ...(team !== undefined && { team }),
    ...(companyId !== undefined && { companyId }),
    ...(timezone !== undefined && { timezone }),
  });

  if (Array.isArray(tagIds)) {
    await tagService.setTagsForEntity('user', user.id, tagIds);
  }

  const updated = await User.findByPk(user.id, { include: [Company] });
  res.json(await serializeUser(updated));
};
