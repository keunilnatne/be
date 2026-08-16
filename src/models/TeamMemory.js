const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-010: 팀 메모리 (패턴 템플릿, 학습 후보, 학습 이력)
class TeamMemory extends Model {}

TeamMemory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    team: { type: DataTypes.STRING, allowNull: true, defaultValue: 'default' },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['pattern', 'candidate', 'log']] },
    },
    title: { type: DataTypes.STRING, allowNull: true },
    purpose: { type: DataTypes.TEXT, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    request: { type: DataTypes.TEXT, allowNull: true },
    deadline: { type: DataTypes.STRING, allowNull: true },
    attachmentName: { type: DataTypes.STRING, allowNull: true },
    text: { type: DataTypes.TEXT, allowNull: true },
    suggestion: { type: DataTypes.TEXT, allowNull: true },
    confidence: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 80 },
    action: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    unread: { type: DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'approved',
      validate: { isIn: [['approved', 'pending', 'rejected']] },
    },
  },
  { sequelize, modelName: 'TeamMemory', tableName: 'team_memories' }
);

module.exports = TeamMemory;

