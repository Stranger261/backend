// models/TrustedDevice.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../../shared/config/db.config.js';

const TrustedDevice = sequelize.define(
  'TrustedDevice',
  {
    device_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    device_fingerprint: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    device_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device_type: {
      type: DataTypes.ENUM('web', 'mobile_ios', 'mobile_android', 'tablet'),
      defaultValue: 'web',
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trusted_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'trusted_devices',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  },
);

export default TrustedDevice;
