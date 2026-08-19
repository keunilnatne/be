const { Tag, User, Recipient, Company } = require('../models');
const tagService = require('../services/tagService');
const aiService = require('../services/aiService');
const ApiError = require('../utils/ApiError');

const ENTITY_MODELS = { user: User, recipient: Recipient, company: Company };

async function assertEntityAccess(req, entityType, entityId) {
  const Model = ENTITY_MODELS[entityType];
  if (!Model) throw ApiError.badRequest(`알 수 없는 entityType입니다: ${entityType}`);
  let entity;
  if (req.user.accountRole === 'admin') {
    entity = await Model.findByPk(entityId);
  } else if (entityType === 'user') {
    entity = Number(entityId) === Number(req.user.id) ? req.user : null;
  } else if (entityType === 'recipient') {
    entity = await Recipient.findOne({ where: { id: entityId, ownerUserId: req.user.id } });
  } else if (entityType === 'company') {
    entity = Number(req.user.companyId) === Number(entityId)
      ? await Company.findByPk(entityId)
      : null;
  }
  if (!entity) throw ApiError.notFound(`${entityType} #${entityId}를 찾을 수 없습니다.`);
  return entity;
}

// 태그 마스터 조회 및 엔티티(user/recipient/company) 부착 (AI 학습 대체용)
exports.list = async (req, res) => {
  const tags = await Tag.findAll({ order: [['category', 'ASC'], ['id', 'ASC']] });
  res.json(tags);
};

exports.attachToEntity = async (req, res) => {
  const { entityType, entityId, tagId } = req.body;
  if (!entityType || !entityId || !tagId) {
    throw ApiError.badRequest('entityType, entityId, tagId는 필수입니다.');
  }
  await assertEntityAccess(req, entityType, entityId);

  await tagService.attachTag(entityType, entityId, tagId);
  const tags = await tagService.getTagsForEntity(entityType, entityId);
  res.json(tags);
};

exports.detachFromEntity = async (req, res) => {
  const { entityType, entityId, tagId } = req.body;
  if (!entityType || !entityId || !tagId) {
    throw ApiError.badRequest('entityType, entityId, tagId는 필수입니다.');
  }
  await assertEntityAccess(req, entityType, entityId);

  await tagService.detachTag(entityType, entityId, tagId);
  const tags = await tagService.getTagsForEntity(entityType, entityId);
  res.json(tags);
};

exports.getForEntity = async (req, res) => {
  const { entityType, entityId } = req.params;
  await assertEntityAccess(req, entityType, entityId);
  const tags = await tagService.getTagsForEntity(entityType, entityId);
  res.json(tags);
};

// AI 자동 태그 모드: 샘플 텍스트를 보고 기존 태그 목록 안에서만 골라 카테고리 단위로 병합/업데이트
exports.inferForEntity = async (req, res) => {
  const { entityType, entityId, sampleText } = req.body;
  if (!entityType || !entityId || !sampleText) {
    throw ApiError.badRequest('entityType, entityId, sampleText는 필수입니다.');
  }
  await assertEntityAccess(req, entityType, entityId);

  const taxonomy = await Tag.findAll();
  const suggestions = await aiService.inferTags({ sampleText, taxonomy });

  const taxonomyByKey = new Map(taxonomy.map((t) => [`${t.category}:${t.name}`, t]));
  const tagIds = suggestions.map((s) => taxonomyByKey.get(`${s.category}:${s.name}`).id);

  const tags = await tagService.mergeInferredTags(entityType, entityId, tagIds);
  res.json({ tags, inferred: suggestions });
};
