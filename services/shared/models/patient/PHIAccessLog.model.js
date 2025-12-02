import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PHIAccessLog extends Model {
  static async logAccess(
    userId,
    staffId,
    patientId,
    accessType,
    resourceType,
    resourceId,
    reason,
    ipAddress
  ) {
    return await this.create({
      user_id: userId,
      staff_id: staffId,
      patient_id: patientId,
      access_type: accessType,
      resource_type: resourceType,
      resource_id: resourceId,
      access_reason: reason,
      ip_address: ipAddress,
    });
  }

  static async getPatientAccessHistory(patientId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return await this.findAll({
      where: {
        patient_id: patientId,
        accessed_at: { [sequelize.Op.gt]: since },
      },
      order: [['accessed_at', 'DESC']],
    });
  }
}

PHIAccessLog.init(
  {
    access_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    staff_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    access_type: {
      type: DataTypes.ENUM(
        'view',
        'edit',
        'create',
        'delete',
        'export',
        'print'
      ),
      allowNull: false,
    },
    resource_type: {
      type: DataTypes.ENUM(
        'medical_record',
        'appointment',
        'admission',
        'er_visit'
      ),
      allowNull: false,
    },
    resource_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    access_reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    accessed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PHIAccessLog',
    tableName: 'phi_access_log',
    timestamps: false,
    indexes: [
      { name: 'idx_patient_time', fields: ['patient_id', 'accessed_at'] },
    ],
  }
);

export default PHIAccessLog;
