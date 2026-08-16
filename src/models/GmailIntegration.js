const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GmailIntegration extends Model {}

GmailIntegration.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
    },
    googleEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'google_email',
    },
    encryptedRefreshToken: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      field: 'encrypted_refresh_token',
    },
    scopes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    connectedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'connected_at',
    },
  },
  {
    sequelize,
    modelName: 'GmailIntegration',
    tableName: 'gmail_integrations',
    underscored: true,
  }
);

module.exports = GmailIntegration;
