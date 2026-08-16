const tagService = require('../services/tagService');

async function serializeUser(user) {
  const tags = await tagService.getTagsForEntity('user', user.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobRole: user.jobRole,
    position: user.position,
    team: user.team,
    defaultLanguage: user.defaultLanguage,
    tools: user.tools || [],
    communicationPreferences: user.communicationPreferences || [],
    customStyle: user.customStyle || '',
    accountRole: user.accountRole,
    authProvider: user.authProvider,
    company: user.Company ? { id: user.Company.id, name: user.Company.name } : null,
    tags: tags.map((tag) => ({
      id: tag.id,
      category: tag.category,
      name: tag.name,
      label: tag.label,
    })),
  };
}

module.exports = serializeUser;
