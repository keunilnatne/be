const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-001: 사용자 및 조직 프로필 설정
// 기본 선호 문체는 필드가 아니라 EntityTag(entityType='user')로 관리 (태그 기반 접근과 통일)
class User extends Model {}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: true },
    authProvider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'local' },
    accountRole: { type: DataTypes.STRING, allowNull: false, defaultValue: 'user' },
    jobRole: { type: DataTypes.STRING },
    position: { type: DataTypes.STRING },
    team: { type: DataTypes.STRING },
    defaultLanguage: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ko' },
    tools: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    communicationPreferences: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    customStyle: { type: DataTypes.TEXT },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'User', tableName: 'users' }
);

module.exports = User;
