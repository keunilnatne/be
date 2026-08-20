const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class InboxMail extends Model {}

InboxMail.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    gmailMessageId: { type: DataTypes.STRING(100), allowNull: false },
    threadId: { type: DataTypes.STRING(100), allowNull: true },
    subject: { type: DataTypes.STRING(500), allowNull: true, defaultValue: '(제목 없음)' },
    from: { type: DataTypes.STRING(500), allowNull: true },
    fromName: { type: DataTypes.STRING(255), allowNull: true },
    fromEmail: { type: DataTypes.STRING(255), allowNull: true },
    date: { type: DataTypes.STRING(100), allowNull: true },
    internalDate: { type: DataTypes.BIGINT, allowNull: true },
    snippet: { type: DataTypes.TEXT, allowNull: true },
    body: { type: DataTypes.TEXT('long'), allowNull: true },
    htmlBody: { type: DataTypes.TEXT('long'), allowNull: true },
    attachments: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  },
  {
    sequelize,
    modelName: 'InboxMail',
    tableName: 'inbox_mails',
    indexes: [
      {
        name: 'inbox_mails_user_gmail_message_unique',
        unique: true,
        fields: ['user_id', 'gmail_message_id'],
      },
    ],
  }
);

module.exports = InboxMail;
