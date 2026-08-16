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
    password: { type: DataTypes.STRING, allowNull: true },
    jobRole: { type: DataTypes.STRING },
    jobTitle: { type: DataTypes.STRING },
    team: { type: DataTypes.STRING },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    companyName: { type: DataTypes.STRING },
    tools: { type: DataTypes.JSON },
    preferredStyle: { type: DataTypes.STRING },
    customStyle: { type: DataTypes.TEXT },
    defaultLanguage: { type: DataTypes.STRING, defaultValue: 'Korean' },
    timezone: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Asia/Seoul' },
    googleConnected: { type: DataTypes.BOOLEAN, defaultValue: false },
    googleEmail: { type: DataTypes.STRING },
  },
  { sequelize, modelName: 'User', tableName: 'users' }
);

module.exports = User;
