const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class MessageResult extends Model {}

MessageResult.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    messageId: { type: DataTypes.INTEGER, allowNull: false },
    recipientId: { type: DataTypes.INTEGER, allowNull: true },

    // 수신자 정보가 변경되거나 삭제되어도 당시 전송 이력을 보존한다.
    recipientName: { type: DataTypes.STRING, allowNull: false },
    recipientEmail: { type: DataTypes.STRING, allowNull: false },
    targetLanguage: { type: DataTypes.STRING, allowNull: true },

    generatedSubject: { type: DataTypes.TEXT, allowNull: true },
    generatedBody: { type: DataTypes.TEXT('long'), allowNull: true },
    finalSubject: { type: DataTypes.TEXT, allowNull: true },
    finalBody: { type: DataTypes.TEXT('long'), allowNull: true },
    appliedContexts: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    qualityScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [[
          'pending',
          'optimizing',
          'optimized',
          'generation_failed',
          'send_pending',
          'sending',
          'sent',
          'send_failed',
        ]],
      },
    },
    generationError: { type: DataTypes.TEXT, allowNull: true },
    sendError: { type: DataTypes.TEXT, allowNull: true },
    gmailMessageId: { type: DataTypes.STRING, allowNull: true },
    sentAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MessageResult',
    tableName: 'message_results',
    indexes: [
      { fields: ['message_id'] },
      { fields: ['recipient_id'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = MessageResult;
