const { sequelize, Message, MessageResult } = require('../models');
const aiService = require('./aiService');
const messageContextService = require('./messageContextService');

const FACT_PATTERNS = [
  /\b\d{4}[.-]\d{1,2}[.-]\d{1,2}\b/g,
  /\d{1,2}월\s*\d{1,2}일/g,
  /[$₩€£]\s?\d[\d,]*(?:\.\d+)?/g,
  /\d[\d,]*(?:\.\d+)?\s?(?:원|만원|억원|달러|USD|KRW|EUR|JPY)/gi,
  /\b\d+(?:\.\d+)?%/g,
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
  /담당자\s*[:：]\s*[^\n,，;；]+/g,
];

function extractRequiredFacts(subject, body) {
  const source = `${subject}\n${body}`;
  const facts = FACT_PATTERNS.flatMap((pattern) => source.match(pattern) || [])
    .map((fact) => fact.startsWith('담당자') ? fact.replace(/^담당자\s*[:：]\s*/, '').trim() : fact);
  return [...new Set(facts)];
}

function findMissingFacts(result, requiredFacts) {
  const output = `${result.subject}\n${result.body}`.replace(/\s/g, '');
  return requiredFacts.filter((fact) => !output.includes(fact.replace(/\s/g, '')));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function callAiWithRetry(optimizeMessage, input, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await optimizeMessage(input);
    } catch (error) {
      lastError = error;
      const retryable = error.statusCode === 429 || error.statusCode >= 500;
      if (!retryable || attempt === maxAttempts) throw error;
      const retryAfterMs = Number(error.retryAfterMs || 0);
      if (retryAfterMs > 5000) throw error;
      await wait(retryAfterMs || 500 * attempt);
    }
  }
  throw lastError;
}

function buildAppliedContext(sender, recipient, teamMemories) {
  return {
    sender: {
      jobRole: sender.jobRole,
      defaultLanguage: sender.defaultLanguage,
      preferredStyle: sender.preferredStyle,
      customStyle: sender.customStyle,
      timezone: sender.timezone || 'Asia/Seoul',
      workHours: sender.workHours || '09:00 - 18:00',
    },
    recipient: {
      name: recipient.name || '수신자',
      email: recipient.email || '',
      jobRole: recipient.jobRole,
      company: recipient.company,
      country: recipient.country,
      language: recipient.language,
      timezone: recipient.timezone,
      relationship: recipient.relationship,
      responseSpeed: recipient.responseSpeed,
      communicationStyle: recipient.communicationStyle,
    },
    teamMemories,
  };
}

async function optimizeRecipient(
  { subject, body, purpose, sender, recipient, teamMemories },
  optimizeMessage = aiService.optimizeMessage
) {
  const context = buildAppliedContext(sender, recipient, teamMemories);
  const requiredFacts = extractRequiredFacts(subject, body);
  let optimized = await optimizeMessage({ subject, body, purpose, context, requiredFacts });
  let missingFacts = findMissingFacts(optimized, requiredFacts);

  if (missingFacts.length) {
    optimized = await optimizeMessage({
      subject,
      body,
      purpose,
      context,
      requiredFacts,
      retryReason: `다음 사실이 누락되었습니다: ${missingFacts.join(', ')}`,
    });
    missingFacts = findMissingFacts(optimized, requiredFacts);
  }

  if (missingFacts.length) {
    const error = new Error(`원문 사실 보존에 실패했습니다: ${missingFacts.join(', ')}`);
    error.statusCode = 502;
    throw error;
  }

  return { ...optimized, appliedContext: context };
}

async function optimizeMany(
  { senderId, recipientIds, subject, body, purpose, priority },
  dependencies = {}
) {
  const loadContext = dependencies.loadContext || messageContextService.loadOptimizationContext;
  const optimizeMessage = dependencies.optimizeMessage || aiService.optimizeMessage;
  const resilientOptimizeMessage = (input) => callAiWithRetry(optimizeMessage, input);
  const runTransaction = dependencies.runTransaction || sequelize.transaction.bind(sequelize);
  const createMessage = dependencies.createMessage || Message.create.bind(Message);
  const createResults = dependencies.createResults || MessageResult.bulkCreate.bind(MessageResult);
  const context = await loadContext({ senderId, recipientIds });
  const outcomes = await Promise.all(context.recipients.map(async (recipient) => {
    try {
      const optimized = await optimizeRecipient(
        { ...context, recipient, subject, body, purpose },
        resilientOptimizeMessage
      );
      return { recipient, optimized, status: 'converted', errorMessage: null };
    } catch (error) {
      return { recipient, optimized: null, status: 'failed', errorMessage: error.message };
    }
  }));

  return runTransaction(async (transaction) => {
    const message = await createMessage({
      senderId,
      originalSubject: subject,
      originalBody: body,
      purpose: purpose || null,
      priority: priority || 'HIGH',
      status: 'optimized',
    }, { transaction });

    const storedResults = await createResults(outcomes.map((outcome) => ({
      messageId: message.id,
      recipientId: outcome.recipient.id,
      recipientName: outcome.recipient.name,
      recipientEmail: outcome.recipient.email,
      optimizedSubject: outcome.optimized?.subject || null,
      optimizedBody: outcome.optimized?.body || null,
      appliedContext: outcome.optimized?.appliedContext || null,
      qualityScore: outcome.optimized?.qualityScore ?? null,
      status: outcome.status,
      errorMessage: outcome.errorMessage,
    })), { transaction, returning: true });

    return { message, results: storedResults };
  });
}

module.exports = {
  callAiWithRetry,
  extractRequiredFacts,
  findMissingFacts,
  optimizeMany,
  optimizeRecipient,
};
