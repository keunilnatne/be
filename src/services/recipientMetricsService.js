const { Op } = require('sequelize');
const {
  Recipient,
  Message,
  MessageResult,
  InboxMail,
} = require('../models');

const METRICS_WINDOW_DAYS = 90;
const RESPONSE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function toTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Each incoming email can answer only one outgoing message. Exact Gmail thread
 * matches take priority. Historical sends made before thread IDs were stored are
 * paired with the latest unmatched send to the same address within seven days.
 */
function pairResponses(sentResults, inboxMails, responseWindowMs = RESPONSE_WINDOW_DAYS * DAY_MS) {
  const sent = sentResults
    .map((item) => ({
      id: Number(item.id),
      at: toTimestamp(item.sentAt),
      threadId: String(item.gmailThreadId || '').trim() || null,
    }))
    .filter((item) => item.at !== null)
    .sort((a, b) => a.at - b.at);
  const inbox = inboxMails
    .map((item) => ({
      id: Number(item.id),
      at: toTimestamp(item.internalDate),
      threadId: String(item.threadId || '').trim() || null,
    }))
    .filter((item) => item.at !== null)
    .sort((a, b) => a.at - b.at);

  const unmatched = new Set(sent.map((item) => item.id));
  const samples = [];

  for (const received of inbox) {
    const eligible = sent.filter((outgoing) => (
      unmatched.has(outgoing.id)
      && outgoing.at <= received.at
      && received.at - outgoing.at <= responseWindowMs
    ));
    if (!eligible.length) continue;

    let candidates = received.threadId
      ? eligible.filter((outgoing) => outgoing.threadId === received.threadId)
      : [];
    if (!candidates.length) {
      // Only legacy sends without a stored thread ID use time-based fallback.
      candidates = eligible.filter((outgoing) => !outgoing.threadId);
    }
    if (!candidates.length) continue;

    const outgoing = candidates.reduce((latest, item) => (
      !latest || item.at > latest.at ? item : latest
    ), null);
    unmatched.delete(outgoing.id);
    samples.push({
      sentResultId: outgoing.id,
      inboxMailId: received.id,
      responseMinutes: Math.max(0, (received.at - outgoing.at) / 60000),
    });
  }

  return samples;
}

function collaborationLevel(score) {
  if (score === null) return null;
  if (score >= 70) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

function relativeSpeed(averageMinutes, baselineMinutes) {
  if (averageMinutes === null || baselineMinutes === null) return null;
  if (baselineMinutes === 0) return averageMinutes === 0 ? '보통' : '느림';
  const ratio = averageMinutes / baselineMinutes;
  if (ratio <= 0.75) return '빠름';
  if (ratio >= 1.5) return '느림';
  return '보통';
}

function buildRecipientMetrics({ recipients, sentResults, inboxMails, now = new Date() }) {
  const windowStart = toTimestamp(now) - METRICS_WINDOW_DAYS * DAY_MS;
  const recentSent = sentResults.filter((item) => {
    const timestamp = toTimestamp(item.sentAt);
    return timestamp !== null && timestamp >= windowStart;
  });
  const recentInbox = inboxMails.filter((item) => {
    const timestamp = toTimestamp(item.internalDate);
    return timestamp !== null && timestamp >= windowStart;
  });

  const provisional = new Map();
  const allResponseSamples = [];

  for (const recipient of recipients) {
    const recipientId = Number(recipient.id);
    const email = normalizeEmail(recipient.email);
    const recipientSent = recentSent.filter((item) => (
      Number(item.recipientId) === recipientId
      || (!item.recipientId && email && normalizeEmail(item.recipientEmail) === email)
    ));
    const uniqueSent = [...new Map(recipientSent.map((item) => [Number(item.id), item])).values()];
    const recipientInbox = email
      ? recentInbox.filter((item) => normalizeEmail(item.fromEmail) === email)
      : [];
    const responseSamples = pairResponses(uniqueSent, recipientInbox);
    const responseMinutes = responseSamples.map((sample) => sample.responseMinutes);
    const repliedResultIds = new Set(responseSamples.map((sample) => sample.sentResultId));
    allResponseSamples.push(...responseMinutes);

    const sentCount = uniqueSent.length;
    const receivedCount = recipientInbox.length;
    const interactionCount = sentCount + receivedCount;
    // A message still inside the seven-day response window is not counted as a
    // non-response. It becomes eligible immediately when a reply is matched.
    const responseOpportunityCount = uniqueSent.filter((item) => (
      repliedResultIds.has(Number(item.id))
      || toTimestamp(item.sentAt) <= toTimestamp(now) - RESPONSE_WINDOW_DAYS * DAY_MS
    )).length;
    const responseRate = responseOpportunityCount > 0
      ? responseSamples.length / responseOpportunityCount
      : null;
    const responsePoints = responseRate === null ? 0 : responseRate * 60;
    // Incoming messages represent the recipient's participation more directly
    // than repeated outbound attempts by the current user.
    const frequencyPoints = Math.min(receivedCount, 5) / 5 * 40;
    const collaborationScore = interactionCount > 0
      ? Math.round(responsePoints + frequencyPoints)
      : null;

    provisional.set(recipientId, {
      averageResponseMinutes: responseMinutes.length
        ? Math.max(1, Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length))
        : null,
      responseSampleCount: responseSamples.length,
      responseRate: responseRate === null ? null : Math.round(responseRate * 100),
      responseOpportunityCount,
      sentCount,
      receivedCount,
      interactionCount,
      collaborationScore,
      collaborationActivity: collaborationLevel(collaborationScore),
    });
  }

  const baselineMinutes = median(allResponseSamples);
  const roundedBaseline = baselineMinutes === null ? null : Math.max(1, Math.round(baselineMinutes));
  const byRecipientId = new Map();
  for (const [recipientId, metrics] of provisional.entries()) {
    byRecipientId.set(recipientId, {
      ...metrics,
      responseSpeed: relativeSpeed(metrics.averageResponseMinutes, roundedBaseline),
      responseBaselineMinutes: roundedBaseline,
      metricsWindowDays: METRICS_WINDOW_DAYS,
      responseWindowDays: RESPONSE_WINDOW_DAYS,
    });
  }

  return { byRecipientId, responseBaselineMinutes: roundedBaseline };
}

async function refreshRecipientMetrics(userId) {
  const recipients = await Recipient.findAll({ where: { ownerUserId: userId } });
  if (!recipients.length) return { byRecipientId: new Map(), responseBaselineMinutes: null };

  const windowStart = new Date(Date.now() - METRICS_WINDOW_DAYS * DAY_MS);
  const [sentResults, inboxMails] = await Promise.all([
    MessageResult.findAll({
      where: {
        status: 'sent',
        sentAt: { [Op.gte]: windowStart },
      },
      include: [{
        model: Message,
        attributes: [],
        required: true,
        where: { senderId: userId },
      }],
    }),
    InboxMail.findAll({
      where: {
        userId,
        internalDate: { [Op.gte]: windowStart.getTime() },
      },
    }),
  ]);

  const calculated = buildRecipientMetrics({ recipients, sentResults, inboxMails });
  await Promise.all(recipients.map(async (recipient) => {
    const metrics = calculated.byRecipientId.get(Number(recipient.id));
    if (!metrics) return;
    const next = {
      responseSpeed: metrics.responseSpeed,
      averageResponseMinutes: metrics.averageResponseMinutes,
      collaborationActivity: metrics.collaborationActivity,
    };
    const changed = recipient.responseSpeed !== next.responseSpeed
      || Number(recipient.averageResponseMinutes || 0) !== Number(next.averageResponseMinutes || 0)
      || recipient.collaborationActivity !== next.collaborationActivity;
    if (changed) await recipient.update(next);
  }));

  return calculated;
}

module.exports = {
  METRICS_WINDOW_DAYS,
  RESPONSE_WINDOW_DAYS,
  normalizeEmail,
  pairResponses,
  relativeSpeed,
  collaborationLevel,
  buildRecipientMetrics,
  refreshRecipientMetrics,
};
