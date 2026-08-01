const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-004(맥락 분석), FS-007(품질 분석) 결과 저장
// TODO: missingInfo, questions, qualityScore, breakdown(JSON) 등 상세 필드 정의
class MessageAnalysis extends Model {}

MessageAnalysis.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    messageId: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'MessageAnalysis', tableName: 'message_analyses' }
);

module.exports = MessageAnalysis;
