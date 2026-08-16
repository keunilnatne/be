const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-010: 팀 메모리 (패턴 템플릿, 학습 후보, 학습 이력)
class TeamMemory extends Model {}

TeamMemory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    team: { type: DataTypes.STRING, defaultValue: 'default' },
    type: { type: DataTypes.STRING, allowNull: false }, // 'pattern' | 'candidate' | 'log'
    title: { type: DataTypes.STRING },
    purpose: { type: DataTypes.TEXT },
    reason: { type: DataTypes.TEXT },
    request: { type: DataTypes.TEXT },
    deadline: { type: DataTypes.STRING },
    attachmentName: { type: DataTypes.STRING },
    text: { type: DataTypes.TEXT },
    suggestion: { type: DataTypes.TEXT },
    confidence: { type: DataTypes.INTEGER, defaultValue: 80 },
    action: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    unread: { type: DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: { type: DataTypes.STRING, defaultValue: 'approved' },
  },
  { sequelize, modelName: 'TeamMemory', tableName: 'team_memories' }
);

module.exports = TeamMemory;
