const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const ApiError = require('../utils/ApiError');

async function loadOptimizationContext({ senderId, recipientIds, transaction }) {
  const [sender] = await sequelize.query(
    `SELECT id, name, email, job_role AS jobRole, job_title AS jobTitle,
            team, company_id AS companyId, company_name AS companyName,
            preferred_style AS preferredStyle, custom_style AS customStyle,
            default_language AS defaultLanguage, timezone, work_hours AS workHours
       FROM users
      WHERE id = :senderId`,
    { replacements: { senderId }, type: QueryTypes.SELECT, transaction }
  );
  if (!sender) throw ApiError.notFound('발신자 프로필을 찾을 수 없습니다.');

  const recipients = await sequelize.query(
    `SELECT id, name, email, job_role AS jobRole, company, country, language,
            timezone, relationship, response_speed AS responseSpeed,
            communication_style AS communicationStyle
       FROM recipients
      WHERE owner_user_id = :senderId
        AND id IN (:recipientIds)`,
    { replacements: { senderId, recipientIds }, type: QueryTypes.SELECT, transaction }
  );
  if (recipients.length !== recipientIds.length) {
    throw ApiError.notFound('일부 수신자를 찾을 수 없거나 접근 권한이 없습니다.');
  }

  let companyDna = null;
  if (sender.companyId) {
    [companyDna] = await sequelize.query(
      `SELECT company_id AS companyId, company_name AS companyName,
              decision_structure AS decisionStructure, channels, reporting,
              terms, rules, accuracy, ai_enabled AS aiEnabled
         FROM company_dna
        WHERE company_id = :companyId
        LIMIT 1`,
      { replacements: { companyId: sender.companyId }, type: QueryTypes.SELECT, transaction }
    );
  }

  const teamMemories = sender.team
    ? await sequelize.query(
      `SELECT id, title, purpose, reason, request, deadline, text, suggestion, confidence
         FROM team_memories
        WHERE team = :team
          AND type = 'pattern'
          AND status = 'approved'`,
      { replacements: { team: sender.team }, type: QueryTypes.SELECT, transaction }
    )
    : [];

  const recipientById = new Map(recipients.map((recipient) => [Number(recipient.id), recipient]));
  return {
    sender,
    companyDna: companyDna?.aiEnabled === 0 ? null : companyDna,
    teamMemories,
    recipients: recipientIds.map((id) => recipientById.get(Number(id))),
  };
}

module.exports = { loadOptimizationContext };
