const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Company,
  UserSetting,
  Recipient,
  Message,
  MessageResult,
  MessageAnalysis,
  TeamMemory,
  GmailIntegration,
  InboxMail,
  EntityTag,
} = require('../models');
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
    jobTitle: user.jobTitle || user.position || '',
    position: user.position || user.jobTitle || '',
    team: user.team || '',
    companyId: user.companyId || null,
    companyName: user.companyName || '',
    tools: user.tools || ['Slack', 'Notion', 'Gmail'],
    communicationPreferences: user.communicationPreferences || [],
    preferredStyle: user.preferredStyle || '명확한 표현 선호',
    customStyle: user.customStyle || '',
    country: user.country || 'South Korea',
    defaultLanguage: user.defaultLanguage || 'Korean',
    language: user.defaultLanguage || 'Korean',
    timezone: user.timezone || 'Asia/Seoul',
    workHours: user.workHours || '09:00 - 18:00',
    lunchHours: user.lunchHours || '12:00 - 13:00',
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
  const { name, email, jobRole, team, companyId, timezone, workHours, tagIds } = req.body;
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
    ...(workHours && { workHours }),
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

  const { name, email, jobRole, jobTitle, position, team, companyId, companyName, tools, preferredStyle, customStyle, defaultLanguage, timezone, workHours, lunchHours, tagIds } = req.body;
  await user.update({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(jobRole !== undefined && { jobRole }),
    ...(jobTitle !== undefined && { jobTitle }),
    ...(position !== undefined && { position }),
    ...(team !== undefined && { team }),
    ...(companyId !== undefined && { companyId }),
    ...(companyName !== undefined && { companyName }),
    ...(tools !== undefined && { tools }),
    ...(preferredStyle !== undefined && { preferredStyle }),
    ...(customStyle !== undefined && { customStyle }),
    ...(defaultLanguage !== undefined && { defaultLanguage }),
    ...(timezone !== undefined && { timezone }),
    ...(workHours !== undefined && { workHours }),
    ...(lunchHours !== undefined && { lunchHours }),
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
  const {
    name,
    role,
    customRole,
    jobRole,
    jobTitle,
    position,
    team,
    company,
    companyName,
    companyId,
    tools,
    communicationPreferences,
    preferredStyle,
    customStyle,
    country,
    language,
    defaultLanguage,
    timezone,
    workHours,
    lunchHours,
    tagIds,
  } = req.body;

  const effectiveJobRole = jobRole !== undefined ? jobRole : (customRole || role);
  const effectiveJobTitle = jobTitle !== undefined ? jobTitle : (position || effectiveJobRole);
  const effectivePosition = position !== undefined ? position : (jobTitle || effectiveJobRole);
  const effectiveCompanyName = companyName !== undefined ? companyName : company;
  const effectiveLanguage = language !== undefined ? language : defaultLanguage;

  await user.update({
    ...(name !== undefined && { name }),
    ...(effectiveJobRole !== undefined && { jobRole: effectiveJobRole }),
    ...(effectiveJobTitle !== undefined && { jobTitle: effectiveJobTitle }),
    ...(effectivePosition !== undefined && { position: effectivePosition }),
    ...(team !== undefined && { team }),
    ...(companyId !== undefined && { companyId }),
    ...(effectiveCompanyName !== undefined && { companyName: effectiveCompanyName }),
    ...(tools !== undefined && { tools }),
    ...(communicationPreferences !== undefined && { communicationPreferences }),
    ...(preferredStyle !== undefined && { preferredStyle }),
    ...(customStyle !== undefined && { customStyle }),
    ...(country !== undefined && { country }),
    ...(effectiveLanguage !== undefined && { defaultLanguage: effectiveLanguage }),
    ...(timezone !== undefined && { timezone }),
    ...(workHours !== undefined && { workHours }),
    ...(lunchHours !== undefined && { lunchHours }),
  });

  if (Array.isArray(tagIds)) {
    await tagService.setTagsForEntity('user', user.id, tagIds);
  }

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
  const deleted = await sequelize.transaction(async (transaction) => {
    const transactionOptions = { transaction };
    const messages = await Message.findAll({
      attributes: ['id'],
      where: { senderId: user.id },
      raw: true,
      ...transactionOptions,
    });
    const messageIds = messages.map(({ id }) => id);

    const recipients = await Recipient.findAll({
      attributes: ['id'],
      where: { ownerUserId: user.id },
      raw: true,
      ...transactionOptions,
    });
    const recipientIds = recipients.map(({ id }) => id);

    let messageAnalyses = 0;
    let messageResults = 0;
    if (messageIds.length) {
      messageAnalyses = await MessageAnalysis.destroy({
        where: { messageId: { [Op.in]: messageIds } },
        ...transactionOptions,
      });
      messageResults = await MessageResult.destroy({
        where: { messageId: { [Op.in]: messageIds } },
        ...transactionOptions,
      });
    }

    let recipientTags = 0;
    if (recipientIds.length) {
      recipientTags = await EntityTag.destroy({
        where: { entityType: 'recipient', entityId: { [Op.in]: recipientIds } },
        ...transactionOptions,
      });
      await MessageResult.update(
        { recipientId: null },
        { where: { recipientId: { [Op.in]: recipientIds } }, ...transactionOptions },
      );
    }

    const counts = {
      messageAnalyses,
      messageResults,
      messages: await Message.destroy({ where: { senderId: user.id }, ...transactionOptions }),
      recipientTags,
      recipients: await Recipient.destroy({ where: { ownerUserId: user.id }, ...transactionOptions }),
      teamMemories: await TeamMemory.destroy({ where: { userId: user.id }, ...transactionOptions }),
      inboxMails: await InboxMail.destroy({ where: { userId: user.id }, ...transactionOptions }),
      gmailIntegrations: await GmailIntegration.destroy({ where: { userId: user.id }, ...transactionOptions }),
      userTags: await EntityTag.destroy({
        where: { entityType: 'user', entityId: user.id },
        ...transactionOptions,
      }),
      userSettings: await UserSetting.destroy({ where: { userId: user.id }, ...transactionOptions }),
    };

    await user.destroy(transactionOptions);
    return counts;
  });

  res.json({
    message: '계정과 모든 관련 데이터가 성공적으로 삭제되었습니다.',
    deleted,
  });
};

// GET /api/users/lookup?email=...
exports.lookupByEmail = async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw ApiError.badRequest('유효한 이메일 주소를 입력해 주세요.');
  }

  const user = await User.findOne({
    where: { email },
    include: [Company],
  });
  if (!user) {
    throw ApiError.notFound('이음에 가입된 회원을 찾을 수 없습니다.', 'IEUM_USER_NOT_FOUND');
  }

  const customStyle = user.customStyle || '';
  const commStyle = Array.isArray(user.communicationPreferences) && user.communicationPreferences.length
    ? user.communicationPreferences
    : (user.preferredStyle ? [user.preferredStyle] : (user.customStyle ? [user.customStyle] : ['명확하고 간결하게']));

  const preferredStyle = commStyle.join(', ') || user.preferredStyle || user.customStyle || '';

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    jobRole: user.jobRole || user.position || user.jobTitle || '',
    role: user.jobRole || user.position || user.jobTitle || '',
    position: user.position || user.jobTitle || user.jobRole || '',
    company: user.companyName || (user.Company ? user.Company.name : ''),
    country: user.country || 'South Korea',
    language: user.defaultLanguage || 'Korean',
    timezone: user.timezone || 'Asia/Seoul',
    organizationRelation: '팀원',
    communicationStyle: commStyle,
    preferredStyle,
    customStyle,
    isIeumUser: true,
  });
};


