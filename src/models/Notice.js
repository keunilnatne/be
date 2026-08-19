const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Notice extends Model {}

Notice.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subtitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tag: {
      type: DataTypes.STRING,
      defaultValue: 'new',
    },
  },
  {
    sequelize,
    modelName: 'Notice',
    tableName: 'notices',
  }
);

module.exports = Notice;
