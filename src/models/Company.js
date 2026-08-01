const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// FS-001, FS-002: 소속 조직
// TODO: 추가 필드 정의
class Company extends Model {}

Company.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: 'Company', tableName: 'companies' }
);

module.exports = Company;
