const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    senderId: { type: DataTypes.INTEGER, allowNull: false },

    // 기존 단일 수신자 변환 API와의 호환을 위해 유지한다.
    recipientId: { type: DataTypes.INTEGER, allowNull: true },

    originalSubject: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    originalBody: { type: DataTypes.TEXT('long'), allowNull: false },
    purpose: { type: DataTypes.STRING, allowNull: true },
    channel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'email' },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [[
          'draft',
          'optimizing',
          'optimized',
          'partially_failed',
          'failed',
          'partially_sent',
          'sent',
        ]],
      },
    },
    optimizedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'Message', tableName: 'messages' }
);

module.exports = Message;
