const test = require('node:test');
const assert = require('node:assert/strict');

const {
  pairResponses,
  relativeSpeed,
  collaborationLevel,
  buildRecipientMetrics,
} = require('../src/services/recipientMetricsService');

const minute = 60 * 1000;

test('response pairing prioritizes an exact Gmail thread', () => {
  const sent = [
    { id: 1, sentAt: new Date(10 * minute), gmailThreadId: 'thread-a' },
    { id: 2, sentAt: new Date(20 * minute), gmailThreadId: 'thread-b' },
  ];
  const inbox = [
    { id: 10, internalDate: 30 * minute, threadId: 'thread-a' },
  ];

  const samples = pairResponses(sent, inbox);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].sentResultId, 1);
  assert.equal(samples[0].responseMinutes, 20);
});

test('legacy sends use the latest unmatched send within seven days', () => {
  const sent = [
    { id: 1, sentAt: new Date(10 * minute) },
    { id: 2, sentAt: new Date(20 * minute) },
  ];
  const inbox = [
    { id: 10, internalDate: 30 * minute },
    { id: 11, internalDate: 8 * 24 * 60 * minute },
  ];

  const samples = pairResponses(sent, inbox);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].sentResultId, 2);
  assert.equal(samples[0].responseMinutes, 10);
});

test('relative speed uses 75% and 150% of the user baseline', () => {
  assert.equal(relativeSpeed(15, 20), '빠름');
  assert.equal(relativeSpeed(21, 20), '보통');
  assert.equal(relativeSpeed(30, 20), '느림');
  assert.equal(relativeSpeed(null, 20), null);
});

test('collaboration activity levels use 70 and 35 point boundaries', () => {
  assert.equal(collaborationLevel(70), 'High');
  assert.equal(collaborationLevel(35), 'Medium');
  assert.equal(collaborationLevel(34), 'Low');
  assert.equal(collaborationLevel(null), null);
});

test('recipient metrics are calculated from recent sent and received mail', () => {
  const now = new Date('2026-08-20T00:00:00.000Z');
  const at = (minutesAgo) => new Date(now.getTime() - minutesAgo * minute);
  const recipients = [
    { id: 1, email: 'fast@example.com' },
    { id: 2, email: 'slow@example.com' },
    { id: 3, email: 'none@example.com' },
  ];
  const sentResults = [
    { id: 1, recipientId: 1, recipientEmail: 'fast@example.com', sentAt: at(200), gmailThreadId: 'a' },
    { id: 2, recipientId: 1, recipientEmail: 'fast@example.com', sentAt: at(100), gmailThreadId: 'b' },
    { id: 3, recipientId: 2, recipientEmail: 'slow@example.com', sentAt: at(300), gmailThreadId: 'c' },
  ];
  const inboxMails = [
    { id: 11, fromEmail: 'FAST@example.com', internalDate: at(190).getTime(), threadId: 'a' },
    { id: 12, fromEmail: 'fast@example.com', internalDate: at(80).getTime(), threadId: 'b' },
    { id: 13, fromEmail: 'slow@example.com', internalDate: at(180).getTime(), threadId: 'c' },
  ];

  const { byRecipientId, responseBaselineMinutes } = buildRecipientMetrics({
    recipients,
    sentResults,
    inboxMails,
    now,
  });

  assert.equal(responseBaselineMinutes, 20);
  assert.deepEqual(
    {
      average: byRecipientId.get(1).averageResponseMinutes,
      speed: byRecipientId.get(1).responseSpeed,
      activity: byRecipientId.get(1).collaborationActivity,
      score: byRecipientId.get(1).collaborationScore,
      rate: byRecipientId.get(1).responseRate,
    },
    { average: 15, speed: '빠름', activity: 'High', score: 76, rate: 100 }
  );
  assert.equal(byRecipientId.get(2).averageResponseMinutes, 120);
  assert.equal(byRecipientId.get(2).responseSpeed, '느림');
  assert.equal(byRecipientId.get(2).collaborationActivity, 'Medium');
  assert.equal(byRecipientId.get(3).averageResponseMinutes, null);
  assert.equal(byRecipientId.get(3).responseSpeed, null);
  assert.equal(byRecipientId.get(3).collaborationActivity, null);
});
