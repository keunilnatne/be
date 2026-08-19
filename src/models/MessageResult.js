const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-004~008: 수신자별 최적화 및 전송 결과 모델
class MessageResult extends Model {}

MessageResult.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    messageId: { type: DataTypes.INTEGER, allowNull: false },
    recipientId: { type: DataTypes.INTEGER, allowNull: true },
    recipientName: { type: DataTypes.STRING, allowNull: true },
    recipientEmail: { type: DataTypes.STRING, allowNull: true },
    optimizedSubject: { type: DataTypes.STRING, allowNull: true },
    optimizedBody: { type: DataTypes.TEXT, allowNull: true },
    finalSubject: { type: DataTypes.STRING, allowNull: true },
    finalBody: { type: DataTypes.TEXT, allowNull: true },
    appliedContext: { type: DataTypes.JSON, allowNull: true },
    qualityScore: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 90 },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'converted',
      validate: { isIn: [['converted', 'sent', 'failed']] },
    },
    sentAt: { type: DataTypes.DATE, allowNull: true },
    gmailMessageId: { type: DataTypes.STRING(100), allowNull: true },
    gmailThreadId: { type: DataTypes.STRING(100), allowNull: true },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'MessageResult', tableName: 'message_results' }
);

module.exports = MessageResult;

