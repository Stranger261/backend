import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class RolePermission extends Model {}

RolePermission.init(
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    permission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    granted_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'RolePermission',
    tableName: 'role_permissions',
    timestamps: true,
    createdAt: 'granted_at',
    updatedAt: false,
  }
);

export default RolePermission;
