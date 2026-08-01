const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-004~006: 메시지 초안/변환 결과
// TODO: purpose, channel, formalityLevel, originalText, convertedText, status 등 상세 필드 정의
class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    recipientId: { type: DataTypes.INTEGER },
  },
  { sequelize, modelName: 'Message', tableName: 'messages' }
);

module.exports = Message;
