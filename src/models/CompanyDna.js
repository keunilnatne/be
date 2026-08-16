const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-002: Company DNA (용어 사전, 문체, 이메일 규칙 등)
// TODO: tone, forbidden_expressions, email_rules, examples 등 상세 필드 정의 (JSON 컬럼 고려)
class CompanyDna extends Model {}

CompanyDna.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
    companyName: { type: DataTypes.STRING },
    decisionStructure: { type: DataTypes.STRING, defaultValue: '수평적 자율성 기반' },
    channels: { type: DataTypes.STRING, defaultValue: 'Slack & Notion' },
    reporting: { type: DataTypes.STRING, defaultValue: '상시 공유 (Always Sync)' },
    terms: { type: DataTypes.JSON, defaultValue: [] },
    rules: { type: DataTypes.JSON, defaultValue: [] },
    accuracy: { type: DataTypes.INTEGER, defaultValue: 92 },
    aiEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: 'CompanyDna', tableName: 'company_dna' }
);

module.exports = CompanyDna;
