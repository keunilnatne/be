const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// user/recipient/company에 태그를 부착하는 폴리모픽 매핑 테이블
// TODO: weight/value 등 세부 속성 정의
class EntityTag extends Model {}

EntityTag.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    entityType: { type: DataTypes.ENUM('user', 'recipient', 'company'), allowNull: false },
    entityId: { type: DataTypes.INTEGER, allowNull: false },
    tagId: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'EntityTag', tableName: 'entity_tags' }
);

module.exports = EntityTag;
