const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// 사용자 개인화 및 계정 설정 모델
class UserSetting extends Model {}

UserSetting.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    tone: { type: DataTypes.STRING, defaultValue: '정중하고 명확한 문체' },
    formality: { type: DataTypes.STRING, defaultValue: '중립적' },
    length: { type: DataTypes.STRING, defaultValue: '요약 위주' },
    aiAutoSuggestion: { type: DataTypes.BOOLEAN, defaultValue: true },
    dataRetentionDays: { type: DataTypes.INTEGER, defaultValue: 90 },
  },
  { sequelize, modelName: 'UserSetting', tableName: 'user_settings' }
);

module.exports = UserSetting;
