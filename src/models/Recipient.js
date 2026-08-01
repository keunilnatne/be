const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-003: 수신자 협업 프로필
// TODO: teamName, requiredInfo(JSON) 등 상세 필드는 추후 확장
class Recipient extends Model {}

Recipient.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    ownerUserId: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    jobRole: { type: DataTypes.STRING },
  },
  { sequelize, modelName: 'Recipient', tableName: 'recipients' }
);

module.exports = Recipient;
