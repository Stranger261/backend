import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Notification extends Model {}

Notification.init(
  {
    notification_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
      unique: true,
    },

    user_uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },

    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },

    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'read_at',

    indexes: [{ name: 'idx_user_uuid', fields: ['user_uuid'] }],
  }
);

export default Notification;
