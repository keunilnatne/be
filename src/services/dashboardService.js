const { Op } = require('sequelize');
const { Message, MessageResult, Recipient } = require('../models');

async function getSummary(userId, dependencies = {}) {
  const countMessages = dependencies.countMessages || Message.count.bind(Message);
  const countResults = dependencies.countResults || MessageResult.count.bind(MessageResult);
  const countRecipients = dependencies.countRecipients || Recipient.count.bind(Recipient);

  const messageOwnership = () => ({
    model: Message,
    required: true,
    where: { senderId: userId },
    attributes: [],
  });
  const [totalMessages, aiConversions, sentMessages, recipients] = await Promise.all([
    countMessages({ where: { senderId: userId } }),
    countResults({
      where: { optimizedSubject: { [Op.ne]: null }, optimizedBody: { [Op.ne]: null } },
      include: [messageOwnership()],
    }),
    countResults({ where: { status: 'sent' }, include: [messageOwnership()] }),
    countRecipients({ where: { ownerUserId: userId } }),
  ]);

  return {
    sentMessages,
    aiConversions,
    recipients,
    totalMessages,
    totalRecipients: recipients,
    aiOptimizedResults: aiConversions,
  };
}

module.exports = { getSummary };
