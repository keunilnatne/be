const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-004~006: 메시지 작성 및 최적화 요청 모델
class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    senderId: { type: DataTypes.INTEGER, allowNull: true },
    originalSubject: { type: DataTypes.STRING, allowNull: true },
    originalBody: { type: DataTypes.TEXT, allowNull: true },
    purpose: { type: DataTypes.STRING, allowNull: true },
    priority: { type: DataTypes.STRING, allowNull: true, defaultValue: 'HIGH' },
    status: { type: DataTypes.STRING, allowNull: true, defaultValue: 'optimized' },
  },
  { sequelize, modelName: 'Message', tableName: 'messages' }
);

module.exports = Message;

