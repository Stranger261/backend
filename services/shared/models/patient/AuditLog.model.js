import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AuditLog extends Model {
  static async logAction(
    userId,
    actionType,
    tableName,
    recordId,
    oldValues,
    newValues,
    ipAddress
  ) {
    return await this.create({
      user_id: userId,
      action_type: actionType,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
    });
  }
}

AuditLog.init(
  {
    audit_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    staff_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action_type: {
      type: DataTypes.ENUM(
        'create',
        'update',
        'delete',
        'login',
        'logout',
        'export'
      ),
      allowNull: false,
    },
    table_name: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    record_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    old_values: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    new_values: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_log',
    timestamps: false,
    createdAt: 'created_at',
    indexes: [
      { name: 'idx_table_record', fields: ['table_name', 'record_id'] },
    ],
  }
);

export default AuditLog;
