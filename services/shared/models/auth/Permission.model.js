import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Permission extends Model {
  static async findByCode(permissionCode) {
    return await this.findOne({ where: { permission_code: permissionCode } });
  }
}

Permission.init(
  {
    permission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    permission_name: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
    },
    permission_code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    resource: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    action: {
      type: DataTypes.ENUM(
        'create',
        'read',
        'update',
        'delete',
        'export',
        'admin'
      ),
      allowNull: false,
    },
    scope: {
      type: DataTypes.ENUM('global', 'department', 'assigned_only', 'own_only'),
      defaultValue: 'global',
    },
    is_sensitive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Permission',
    tableName: 'permissions',
    timestamps: false,
  }
);

export default Permission;
