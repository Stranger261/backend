// models/TwoFactorAuth.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../../shared/config/db.config.js';

const TwoFactorAuth = sequelize.define(
  'TwoFactorAuth',
  {
    tfa_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    method: {
      type: DataTypes.ENUM('totp', 'sms', 'email', 'disabled'),
      defaultValue: 'email',
    },
    secret_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    backup_codes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    enabled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'two_factor_auth',
    timestamps: false,
    underscored: true,
  },
);

export default TwoFactorAuth;
