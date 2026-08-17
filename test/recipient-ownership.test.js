const test = require('node:test');
const assert = require('node:assert/strict');

const recipientController = require('../src/controllers/recipient.controller');

test('recipient ownership filter always includes the authenticated user', () => {
  assert.deepEqual(recipientController.ownedRecipientWhere(7), {
    ownerUserId: 7,
  });
  assert.deepEqual(recipientController.ownedRecipientWhere(7, 15), {
    ownerUserId: 7,
    id: 15,
  });
});

test('the client cannot override recipient ownership through filter construction', () => {
  const where = recipientController.ownedRecipientWhere(7, 15);
  assert.equal(where.ownerUserId, 7);
  assert.notEqual(where.ownerUserId, 8);
});
