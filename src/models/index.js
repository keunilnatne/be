const sequelize = require('../config/database');

const User = require('./User');
const Company = require('./Company');
const CompanyDna = require('./CompanyDna');
const Recipient = require('./Recipient');
const Tag = require('./Tag');
const EntityTag = require('./EntityTag');
const Message = require('./Message');
const MessageResult = require('./MessageResult');
const MessageAnalysis = require('./MessageAnalysis');

Tag.hasMany(EntityTag, { foreignKey: 'tagId' });
EntityTag.belongsTo(Tag, { foreignKey: 'tagId' });

Company.hasMany(User, { foreignKey: 'companyId' });
User.belongsTo(Company, { foreignKey: 'companyId' });

User.hasMany(Recipient, { foreignKey: 'ownerUserId', as: 'Recipients' });
Recipient.belongsTo(User, { foreignKey: 'ownerUserId', as: 'Owner' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'Messages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'Sender' });

Message.hasMany(MessageResult, {
  foreignKey: 'messageId',
  as: 'results',
  onDelete: 'CASCADE',
});
MessageResult.belongsTo(Message, { foreignKey: 'messageId' });

Recipient.hasMany(MessageResult, { foreignKey: 'recipientId', as: 'MessageResults' });
MessageResult.belongsTo(Recipient, { foreignKey: 'recipientId' });

Message.hasMany(MessageAnalysis, {
  foreignKey: 'messageId',
  as: 'analyses',
  onDelete: 'CASCADE',
});
MessageAnalysis.belongsTo(Message, { foreignKey: 'messageId' });

module.exports = {
  sequelize,
  User,
  Company,
  CompanyDna,
  Recipient,
  Tag,
  EntityTag,
  Message,
  MessageResult,
  MessageAnalysis,
};
