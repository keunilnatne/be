const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TeamMemory extends Model {}

TeamMemory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    team: { type: DataTypes.STRING, allowNull: true, defaultValue: 'default' },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isIn: [['pattern', 'candidate', 'log']] },
    },
    title: { type: DataTypes.STRING, allowNull: true },
    purpose: { type: DataTypes.TEXT, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    request: { type: DataTypes.TEXT, allowNull: true },
    deadline: { type: DataTypes.STRING, allowNull: true },
    text: { type: DataTypes.TEXT, allowNull: true },
    suggestion: { type: DataTypes.TEXT, allowNull: true },
    confidence: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 80 },
    action: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
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
