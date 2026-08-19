const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../src/models');
const userController = require('../src/controllers/user.controller');

test('account deletion removes every user-owned data category in one transaction', async () => {
  const originals = {
    transaction: models.sequelize.transaction,
    messageFindAll: models.Message.findAll,
    recipientFindAll: models.Recipient.findAll,
    messageAnalysisDestroy: models.MessageAnalysis.destroy,
    messageResultDestroy: models.MessageResult.destroy,
    messageResultUpdate: models.MessageResult.update,
    messageDestroy: models.Message.destroy,
    recipientDestroy: models.Recipient.destroy,
    teamMemoryDestroy: models.TeamMemory.destroy,
    inboxMailDestroy: models.InboxMail.destroy,
    gmailIntegrationDestroy: models.GmailIntegration.destroy,
    entityTagDestroy: models.EntityTag.destroy,
    userSettingDestroy: models.UserSetting.destroy,
  };
  const calls = [];

  models.sequelize.transaction = async (callback) => callback({ id: 'transaction' });
  models.Message.findAll = async () => [{ id: 10 }, { id: 11 }];
  models.Recipient.findAll = async () => [{ id: 20 }];

  for (const [label, model] of [
    ['messageAnalyses', models.MessageAnalysis],
    ['messageResults', models.MessageResult],
    ['messages', models.Message],
    ['recipients', models.Recipient],
    ['teamMemories', models.TeamMemory],
    ['inboxMails', models.InboxMail],
    ['gmailIntegrations', models.GmailIntegration],
    ['entityTags', models.EntityTag],
    ['userSettings', models.UserSetting],
  ]) {
    model.destroy = async (options) => {
      calls.push({ label, options });
      return 1;
    };
  }
  models.MessageResult.update = async (values, options) => {
    calls.push({ label: 'messageResultRecipientUnlink', values, options });
    return [1];
  };

  let userDestroyed = false;
  const req = {
    user: {
      id: 7,
      destroy: async ({ transaction }) => {
        assert.equal(transaction.id, 'transaction');
        userDestroyed = true;
      },
    },
  };
  let responseBody;
  const res = { json: (body) => { responseBody = body; } };

  try {
    await userController.deleteMe(req, res);
    assert.equal(userDestroyed, true);
    assert.match(responseBody.message, /모든 관련 데이터/);
    for (const required of [
      'messageAnalyses',
      'messageResults',
      'messages',
      'recipients',
      'teamMemories',
      'inboxMails',
      'gmailIntegrations',
      'entityTags',
      'userSettings',
      'messageResultRecipientUnlink',
    ]) {
      assert.ok(calls.some(({ label }) => label === required), `${required} was not handled`);
    }
  } finally {
    models.sequelize.transaction = originals.transaction;
    models.Message.findAll = originals.messageFindAll;
    models.Recipient.findAll = originals.recipientFindAll;
    models.MessageAnalysis.destroy = originals.messageAnalysisDestroy;
    models.MessageResult.destroy = originals.messageResultDestroy;
    models.MessageResult.update = originals.messageResultUpdate;
    models.Message.destroy = originals.messageDestroy;
    models.Recipient.destroy = originals.recipientDestroy;
    models.TeamMemory.destroy = originals.teamMemoryDestroy;
    models.InboxMail.destroy = originals.inboxMailDestroy;
    models.GmailIntegration.destroy = originals.gmailIntegrationDestroy;
    models.EntityTag.destroy = originals.entityTagDestroy;
    models.UserSetting.destroy = originals.userSettingDestroy;
  }
});
