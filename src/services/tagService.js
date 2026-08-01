const { EntityTag, Tag } = require('../models');

// entityType: 'user' | 'recipient' | 'company'
async function getTagsForEntity(entityType, entityId) {
  const links = await EntityTag.findAll({
    where: { entityType, entityId },
    include: [{ model: Tag }],
  });
  return links.map((link) => link.Tag);
}

async function attachTag(entityType, entityId, tagId) {
  const [link] = await EntityTag.findOrCreate({ where: { entityType, entityId, tagId } });
  return link;
}

async function detachTag(entityType, entityId, tagId) {
  await EntityTag.destroy({ where: { entityType, entityId, tagId } });
}

// 엔티티의 태그 구성을 통째로 교체 (프로필 생성/수정 폼에서 사용)
async function setTagsForEntity(entityType, entityId, tagIds) {
  await EntityTag.destroy({ where: { entityType, entityId } });
  await Promise.all(tagIds.map((tagId) => EntityTag.create({ entityType, entityId, tagId })));
}

// AI가 새로 추론한 태그를 기존 태그와 "병합": 같은 카테고리(tone/verbosity 등)만 교체하고
// 이번에 추론되지 않은 카테고리의 기존 태그는 그대로 둔다. (넣을 때마다 업데이트되는 방식)
async function mergeInferredTags(entityType, entityId, tagIds) {
  if (!tagIds.length) return getTagsForEntity(entityType, entityId);

  const tagsToApply = await Tag.findAll({ where: { id: tagIds } });
  const touchedCategories = [...new Set(tagsToApply.map((t) => t.category))];

  const existingLinks = await EntityTag.findAll({
    where: { entityType, entityId },
    include: [{ model: Tag }],
  });
  const toRemove = existingLinks.filter((link) => touchedCategories.includes(link.Tag.category));
  await Promise.all(toRemove.map((link) => link.destroy()));

  await Promise.all(
    tagIds.map((tagId) => EntityTag.findOrCreate({ where: { entityType, entityId, tagId } }))
  );

  return getTagsForEntity(entityType, entityId);
}

module.exports = { getTagsForEntity, attachTag, detachTag, setTagsForEntity, mergeInferredTags };
