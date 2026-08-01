const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-002: Company DNA (용어 사전, 문체, 이메일 규칙 등)
// TODO: tone, forbidden_expressions, email_rules, examples 등 상세 필드 정의 (JSON 컬럼 고려)
class CompanyDna extends Model {}

CompanyDna.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'CompanyDna', tableName: 'company_dna' }
);

module.exports = CompanyDna;
