const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-004~008: 수신자별 최적화 및 전송 결과 모델
class MessageResult extends Model {}

MessageResult.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    messageId: { type: DataTypes.INTEGER, allowNull: false },
    recipientId: { type: DataTypes.INTEGER, allowNull: true },
    recipientName: { type: DataTypes.STRING },
    recipientEmail: { type: DataTypes.STRING },
    optimizedSubject: { type: DataTypes.STRING },
    optimizedBody: { type: DataTypes.TEXT },
    finalSubject: { type: DataTypes.STRING },
    finalBody: { type: DataTypes.TEXT },
    appliedContext: { type: DataTypes.JSON },
    qualityScore: { type: DataTypes.INTEGER, defaultValue: 90 },
    status: { type: DataTypes.STRING, defaultValue: 'converted' },
    sentAt: { type: DataTypes.DATE },
    errorMessage: { type: DataTypes.TEXT },
  },
  { sequelize, modelName: 'MessageResult', tableName: 'message_results' }
);

module.exports = MessageResult;
