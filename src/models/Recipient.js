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
    company: { type: DataTypes.STRING },
    country: { type: DataTypes.STRING, defaultValue: 'South Korea' },
    language: { type: DataTypes.STRING, defaultValue: 'Korean' },
    timezone: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Asia/Seoul' },
    relationship: { type: DataTypes.STRING, defaultValue: 'External Partner' },
    responseSpeed: { type: DataTypes.STRING, defaultValue: '보통' },
    averageResponseMinutes: { type: DataTypes.INTEGER, defaultValue: 30 },
    collaborationActivity: { type: DataTypes.STRING, defaultValue: 'Medium' },
    isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
    isFavorite: { type: DataTypes.BOOLEAN, defaultValue: false },
    isRecent: { type: DataTypes.BOOLEAN, defaultValue: true },
    verifiedExpert: { type: DataTypes.BOOLEAN, defaultValue: false },
    fullTime: { type: DataTypes.BOOLEAN, defaultValue: true },
    avatar: { type: DataTypes.STRING },
    memo: { type: DataTypes.TEXT },
    communicationStyle: { type: DataTypes.JSON },
    preferredStyle: { type: DataTypes.STRING },
    customStyle: { type: DataTypes.TEXT },
  },
  { sequelize, modelName: 'Recipient', tableName: 'recipients' }
);

module.exports = Recipient;
