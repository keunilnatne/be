const { Recipient } = require('../models');
const tagService = require('../services/tagService');
const ApiError = require('../utils/ApiError');

// FS-003: 수신자 협업 프로필 관리 (MVP: 태그 기반 프로필 CRUD)
async function serializeRecipient(recipient) {
  const tags = await tagService.getTagsForEntity('recipient', recipient.id);
  return {
    id: recipient.id,
    name: recipient.name,
    email: recipient.email,
    jobRole: recipient.jobRole,
    tags: tags.map((t) => ({ id: t.id, category: t.category, name: t.name, label: t.label })),
  };
}

exports.list = async (req, res) => {
  const recipients = await Recipient.findAll();
  res.json(await Promise.all(recipients.map(serializeRecipient)));
};

exports.create = async (req, res) => {
  const { name, email, jobRole, tagIds } = req.body;
  if (!name) {
    throw ApiError.badRequest('name은 필수입니다.');
  }

  const recipient = await Recipient.create({ name, email, jobRole });

  if (Array.isArray(tagIds) && tagIds.length) {
    await tagService.setTagsForEntity('recipient', recipient.id, tagIds);
  }

  res.status(201).json(await serializeRecipient(recipient));
};

exports.getOne = async (req, res) => {
  const recipient = await Recipient.findByPk(req.params.recipientId);
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');
  res.json(await serializeRecipient(recipient));
};

exports.update = async (req, res) => {
  const recipient = await Recipient.findByPk(req.params.recipientId);
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');

  const { name, email, jobRole, tagIds } = req.body;
  await recipient.update({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(jobRole !== undefined && { jobRole }),
  });

  if (Array.isArray(tagIds)) {
    await tagService.setTagsForEntity('recipient', recipient.id, tagIds);
  }

  res.json(await serializeRecipient(recipient));
};
