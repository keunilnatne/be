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
    jobRole: { type: DataTypes.STRING },
    team: { type: DataTypes.STRING },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    // IANA 타임존 문자열 (예: 'Asia/Seoul'). 수신자와 시간대가 다를 때 시간 변환에 사용.
    timezone: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Asia/Seoul' },
  },
  { sequelize, modelName: 'User', tableName: 'users' }
);

module.exports = User;
