const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// 한 Message에 속한 수신자별 AI 최적화 및 Gmail 발송 결과를 저장한다.
// 공용 Railway DB의 기존 컬럼은 삭제하거나 변경하지 않고 그대로 매핑한다.
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
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'MessageResult', tableName: 'message_results' }
);

module.exports = MessageResult;
