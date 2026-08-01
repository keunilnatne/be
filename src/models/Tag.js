const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// AI 학습 대체용 태그 마스터 (예: tone, verbosity, structure, directness 카테고리)
class Tag extends Model {}

Tag.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    category: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: false },
    // AI 프롬프트에 그대로 주입되는 지시문
    promptGuideline: { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, modelName: 'Tag', tableName: 'tags' }
);

module.exports = Tag;
