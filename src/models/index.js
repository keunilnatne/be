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
const UserSetting = require('./UserSetting');

Tag.hasMany(EntityTag, { foreignKey: 'tagId' });
EntityTag.belongsTo(Tag, { foreignKey: 'tagId' });

Company.hasMany(User, { foreignKey: 'companyId' });
User.belongsTo(Company, { foreignKey: 'companyId' });

User.hasOne(UserSetting, { foreignKey: 'userId', as: 'setting' });
UserSetting.belongsTo(User, { foreignKey: 'userId' });

Message.hasMany(MessageResult, { foreignKey: 'messageId', as: 'results' });
MessageResult.belongsTo(Message, { foreignKey: 'messageId' });

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
  UserSetting,
};
