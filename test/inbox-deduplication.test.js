const test = require('node:test');
const assert = require('node:assert/strict');

const { InboxMail } = require('../src/models');
const gmailService = require('../src/services/gmailService');
const {
  UNIQUE_INDEX_NAME,
  ensureInboxMailUniqueness,
} = require('../src/services/inboxMailIntegrityService');

test('InboxMail uniquely identifies one Gmail message per user', () => {
  const index = InboxMail.options.indexes.find((candidate) => candidate.name === UNIQUE_INDEX_NAME);
  assert.ok(index);
  assert.equal(index.unique, true);
  assert.deepEqual(index.fields, ['user_id', 'gmail_message_id']);
});

test('inbox serialization removes repeated Gmail message ids while preserving order', () => {
  const messages = gmailService.deduplicateInboxMessages([
    { gmailMessageId: 'newest', subject: 'first' },
    { gmailMessageId: 'newest', subject: 'duplicate' },
    { gmailMessageId: 'older', subject: 'second' },
  ]);

  assert.deepEqual(messages.map((message) => message.subject), ['first', 'second']);
});

test('inbox integrity migration removes old copies before adding the unique index', async () => {
  const statements = [];
  const database = {
    async query(sql) {
      statements.push(sql.replace(/\s+/g, ' ').trim());
    },
  };

  const result = await ensureInboxMailUniqueness(database);

  assert.deepEqual(result, { tableMissing: false });
  assert.match(statements[0], /older\.id < newer\.id/);
  assert.match(statements[1], new RegExp(`ADD UNIQUE INDEX ${UNIQUE_INDEX_NAME}`));
});
