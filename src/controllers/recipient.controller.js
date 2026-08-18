const { Recipient, User } = require('../models');
const { Op } = require('sequelize');
const tagService = require('../services/tagService');
const ApiError = require('../utils/ApiError');

const initialRecipients = [
  {
    id: 1,
    name: '김민수',
    email: 'minsu.kim@abccompany.com',
    jobRole: 'Product Designer',
    company: 'ABC Company',
    country: 'South Korea',
    language: 'Korean',
    timezone: 'Asia/Seoul',
    relationship: 'External Partner',
    responseSpeed: '빠름',
    averageResponseMinutes: 14,
    collaborationActivity: 'High',
    isOnline: true,
    isFavorite: true,
    isRecent: true,
    verifiedExpert: true,
    fullTime: true,
    avatar: '김',
  },
  {
    id: 2,
    name: '이서연',
    email: 'seoyeon.lee@novainc.com',
    jobRole: 'Marketing Lead',
    company: 'Nova Inc.',
    country: 'South Korea',
    language: 'Korean',
    timezone: 'Asia/Seoul',
    relationship: 'External Partner',
    responseSpeed: '보통',
    averageResponseMinutes: 38,
    collaborationActivity: 'Medium',
    isOnline: false,
    isFavorite: true,
    isRecent: true,
    verifiedExpert: false,
    fullTime: true,
    avatar: '이',
  },
  {
    id: 3,
    name: '박준호',
    email: 'junho.park@abccompany.com',
    jobRole: 'Backend Engineer',
    company: 'ABC Company',
    country: 'South Korea',
    language: 'Korean',
    timezone: 'Asia/Seoul',
    relationship: 'Internal Team',
    responseSpeed: '느림',
    averageResponseMinutes: 92,
    collaborationActivity: 'Low',
    isOnline: false,
    isFavorite: false,
    isRecent: true,
    verifiedExpert: false,
    fullTime: false,
    avatar: '박',
  },
  {
    id: 4,
    name: '최유리',
    email: 'yuri.choi@studiobright.com',
    jobRole: 'CEO',
    company: 'Studio Bright',
    country: 'South Korea',
    language: 'Korean',
    timezone: 'Asia/Seoul',
    relationship: 'External Partner',
    responseSpeed: '빠름',
    averageResponseMinutes: 10,
    collaborationActivity: 'High',
    isOnline: true,
    isFavorite: false,
    isRecent: false,
    verifiedExpert: true,
    fullTime: true,
    avatar: '최',
  },
  {
    id: 5,
    name: 'Aditya Putra',
    email: 'aditya.putra@majudigital.com',
    jobRole: 'Backend Developer',
    company: 'PT. Maju Digital',
    country: 'Indonesia',
    language: 'English',
    timezone: 'Asia/Jakarta',
    relationship: 'External Partner',
    responseSpeed: '보통',
    averageResponseMinutes: 45,
    collaborationActivity: 'Medium',
    isOnline: true,
    isFavorite: true,
    isRecent: true,
    verifiedExpert: false,
    fullTime: true,
    avatar: 'Ad',
  },
];

async function ensureSeedRecipients() {
  const count = await Recipient.count();
  if (count === 0) {
    await Recipient.bulkCreate(initialRecipients);
  }
}

function ownedRecipientWhere(userId, recipientId) {
  const where = { ownerUserId: userId };
  if (recipientId !== undefined) where.id = recipientId;
  return where;
}

exports.ownedRecipientWhere = ownedRecipientWhere;

function normalizeRecipientEmail(email) {
  return String(email || '').trim().toLowerCase();
}

exports.normalizeRecipientEmail = normalizeRecipientEmail;

function cleanResponseSpeed(speed) {
  const s = String(speed || '').trim();
  if (s.includes('빠') || s.toLowerCase().includes('fast')) return '빠름';
  if (s.includes('느') || s.toLowerCase().includes('slow')) return '느림';
  if (s.includes('보') || s.toLowerCase().includes('normal')) return '보통';
  return s || null;
}

async function serializeRecipient(recipient) {
  const tags = await tagService.getTagsForEntity('recipient', recipient.id);
  return {
    id: recipient.id,
    name: recipient.name,
    email: recipient.email || '',
    jobRole: recipient.jobRole || '',
    role: recipient.jobRole || '',
    position: recipient.jobRole || '',
    company: recipient.company || '',
    country: recipient.country || 'South Korea',
    language: recipient.language || 'Korean',
    timezone: recipient.timezone || 'Asia/Seoul',
    relationship: recipient.relationship || 'External Partner',
    organizationRelation: recipient.relationship || 'External Partner',
    responseSpeed: cleanResponseSpeed(recipient.responseSpeed),
    averageResponseMinutes: recipient.averageResponseMinutes ? Number(recipient.averageResponseMinutes) : null,
    collaborationActivity: recipient.collaborationActivity || null,
    isOnline: recipient.isOnline ?? false,
    isFavorite: recipient.isFavorite ?? false,
    isRecent: recipient.isRecent ?? true,
    verifiedExpert: recipient.verifiedExpert ?? false,
    fullTime: recipient.fullTime ?? true,
    avatar: recipient.avatar || recipient.name?.slice(0, 1) || '?',
    memo: recipient.memo || '',
    communicationStyle: recipient.communicationStyle || null,
    tags: tags.map((t) => ({ id: t.id, category: t.category, name: t.name, label: t.label })),
  };
}

exports.list = async (req, res) => {
  const { q, tab } = req.query;
  const where = ownedRecipientWhere(req.user.id);

  if (tab === 'favorite') {
    where.isFavorite = true;
  } else if (tab === 'recent') {
    where.isRecent = true;
  }

  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { email: { [Op.like]: `%${q}%` } },
      { company: { [Op.like]: `%${q}%` } },
      { jobRole: { [Op.like]: `%${q}%` } },
    ];
  }

  const recipients = await Recipient.findAll({ where, order: [['id', 'ASC']] });
  res.json(await Promise.all(recipients.map(serializeRecipient)));
};

exports.getByEmail = async (req, res) => {
  const email = normalizeRecipientEmail(req.query.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw ApiError.badRequest('유효한 이메일 주소를 입력해 주세요.');
  }

  // 1. 이음에 가입된 회원(User 디비) 프로필 조회 우선
  const user = await User.findOne({ where: { email } });
  if (user) {
    const commStyle = Array.isArray(user.communicationPreferences) && user.communicationPreferences.length
      ? user.communicationPreferences
      : (user.preferredStyle ? [user.preferredStyle] : ['명확하고 간결하게']);

    return res.json({
      id: null,
      name: user.name,
      email: user.email,
      jobRole: user.jobRole || user.position || user.jobTitle || '',
      role: user.jobRole || user.position || user.jobTitle || '',
      position: user.position || user.jobTitle || user.jobRole || '',
      company: user.companyName || '',
      country: 'South Korea',
      language: user.defaultLanguage || 'Korean',
      timezone: user.timezone || 'Asia/Seoul',
      relationship: '팀원',
      organizationRelation: '팀원',
      responseSpeed: '보통',
      averageResponseMinutes: 15,
      collaborationActivity: 'High',
      isOnline: true,
      isFavorite: false,
      isRecent: true,
      verifiedExpert: false,
      fullTime: true,
      avatar: user.name?.slice(0, 1) || '?',
      communicationStyle: commStyle,
      preferredStyle: user.preferredStyle || '',
      isIeumUser: true,
    });
  }

  // 2. 기존 수신자 디비 확인
  const recipient = await Recipient.findOne({
    where: { ...ownedRecipientWhere(req.user.id), email },
  });
  if (recipient) {
    return res.json(await serializeRecipient(recipient));
  }

  throw ApiError.notFound('등록된 이메일 정보를 찾을 수 없습니다.', 'RECIPIENT_EMAIL_NOT_FOUND');
};

exports.create = async (req, res) => {
  const {
    name,
    email,
    jobRole,
    role,
    position,
    company,
    country,
    language,
    timezone,
    relationship,
    organizationRelation,
    responseSpeed,
    averageResponseMinutes,
    collaborationActivity,
    isOnline,
    isFavorite,
    isRecent,
    verifiedExpert,
    fullTime,
    avatar,
    memo,
    communicationStyle,
    preferredStyle,
    customStyle,
    tagIds,
  } = req.body;

  if (!name) {
    throw ApiError.badRequest('name은 필수입니다.');
  }

  const normalizedEmail = normalizeRecipientEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw ApiError.badRequest('유효한 이메일 주소를 입력해 주세요.');
  }

  const duplicate = await Recipient.findOne({
    where: { ...ownedRecipientWhere(req.user.id), email: normalizedEmail },
  });
  if (duplicate) {
    throw new ApiError(409, '이미 등록된 수신자 이메일입니다.', null, 'RECIPIENT_EMAIL_ALREADY_EXISTS');
  }

  const finalStyle = Array.isArray(communicationStyle)
    ? communicationStyle
    : (typeof communicationStyle === 'string' && communicationStyle.trim()
      ? [communicationStyle.trim()]
      : (preferredStyle || customStyle ? [preferredStyle || customStyle] : ['명확한 표현 선호']));

  const recipient = await Recipient.create({
    ownerUserId: req.user.id,
    name,
    email: normalizedEmail,
    jobRole: jobRole || role || position || '',
    company,
    country,
    language,
    timezone: timezone || 'Asia/Seoul',
    relationship: relationship || organizationRelation || 'External Partner',
    responseSpeed,
    averageResponseMinutes,
    collaborationActivity,
    isOnline,
    isFavorite,
    isRecent,
    verifiedExpert,
    fullTime,
    avatar,
    memo,
    communicationStyle: finalStyle,
  });

  if (Array.isArray(tagIds) && tagIds.length) {
    await tagService.setTagsForEntity('recipient', recipient.id, tagIds);
  }

  res.status(201).json(await serializeRecipient(recipient));
};

exports.getOne = async (req, res) => {
  const recipient = await Recipient.findOne({
    where: ownedRecipientWhere(req.user.id, req.params.recipientId),
  });
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');
  res.json(await serializeRecipient(recipient));
};

exports.update = async (req, res) => {
  const recipient = await Recipient.findOne({
    where: ownedRecipientWhere(req.user.id, req.params.recipientId),
  });
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');

  const {
    name,
    email,
    jobRole,
    role,
    position,
    company,
    country,
    language,
    timezone,
    relationship,
    organizationRelation,
    responseSpeed,
    averageResponseMinutes,
    collaborationActivity,
    isOnline,
    isFavorite,
    isRecent,
    verifiedExpert,
    fullTime,
    avatar,
    memo,
    communicationStyle,
    tagIds,
  } = req.body;

  await recipient.update({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...((jobRole || role || position) !== undefined && { jobRole: jobRole || role || position }),
    ...(company !== undefined && { company }),
    ...(country !== undefined && { country }),
    ...(language !== undefined && { language }),
    ...(timezone !== undefined && { timezone }),
    ...((relationship || organizationRelation) !== undefined && { relationship: relationship || organizationRelation }),
    ...(responseSpeed !== undefined && { responseSpeed }),
    ...(averageResponseMinutes !== undefined && { averageResponseMinutes }),
    ...(collaborationActivity !== undefined && { collaborationActivity }),
    ...(isOnline !== undefined && { isOnline }),
    ...(isFavorite !== undefined && { isFavorite }),
    ...(isRecent !== undefined && { isRecent }),
    ...(verifiedExpert !== undefined && { verifiedExpert }),
    ...(fullTime !== undefined && { fullTime }),
    ...(avatar !== undefined && { avatar }),
    ...(memo !== undefined && { memo }),
    ...(communicationStyle !== undefined && { communicationStyle }),
  });

  if (Array.isArray(tagIds)) {
    await tagService.setTagsForEntity('recipient', recipient.id, tagIds);
  }

  res.json(await serializeRecipient(recipient));
};

exports.toggleFavorite = async (req, res) => {
  const recipient = await Recipient.findOne({
    where: ownedRecipientWhere(req.user.id, req.params.recipientId),
  });
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');

  await recipient.update({ isFavorite: !recipient.isFavorite });
  res.json(await serializeRecipient(recipient));
};

exports.delete = async (req, res) => {
  const recipient = await Recipient.findOne({
    where: ownedRecipientWhere(req.user.id, req.params.recipientId),
  });
  if (!recipient) throw ApiError.notFound('수신자를 찾을 수 없습니다.');

  await recipient.destroy();
  res.json({ message: '수신자가 삭제되었습니다.' });
};
