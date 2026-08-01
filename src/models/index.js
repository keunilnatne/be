const sequelize = require('../config/database');

const User = require('./User');
const Company = require('./Company');
const CompanyDna = require('./CompanyDna');
const Recipient = require('./Recipient');
const Tag = require('./Tag');
const EntityTag = require('./EntityTag');
const Message = require('./Message');
const MessageAnalysis = require('./MessageAnalysis');

Tag.hasMany(EntityTag, { foreignKey: 'tagId' });
EntityTag.belongsTo(Tag, { foreignKey: 'tagId' });

Company.hasMany(User, { foreignKey: 'companyId' });
User.belongsTo(Company, { foreignKey: 'companyId' });

module.exports = {
  sequelize,
  User,
  Company,
  CompanyDna,
  Recipient,
  Tag,
  EntityTag,
  Message,
  MessageAnalysis,
};
