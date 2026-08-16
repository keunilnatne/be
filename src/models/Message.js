const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-004~006: 메시지 생성/변환 모델
class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    senderId: { type: DataTypes.INTEGER, allowNull: true },
    originalSubject: { type: DataTypes.STRING },
    originalBody: { type: DataTypes.TEXT },
    purpose: { type: DataTypes.STRING },
    priority: { type: DataTypes.STRING, defaultValue: 'HIGH' },
    status: { type: DataTypes.STRING, defaultValue: 'optimized' },
  },
  { sequelize, modelName: 'Message', tableName: 'messages' }
);

module.exports = Message;
