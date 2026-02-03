import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PHIAccessLog extends Model {
  /**
   * Log access to patient medical records
   * This should be called every time someone views, exports, or prints patient data
   */
  static async logAccess(
    userId,
    staffId,
    userRole,
    patientId,
    accessType,
    resourceType,
    resourceId,
    reason,
    ipAddress,
    userAgent = null,
    sessionId = null,
    accessMethod = 'web',
  ) {
    try {
      return await this.create({
        user_id: userId,
        staff_id: staffId,
        user_role: userRole,
        patient_id: patientId,
        access_type: accessType,
        resource_type: resourceType,
        resource_id: resourceId,
        access_reason: reason,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: sessionId,
        access_method: accessMethod,
        accessed_at: new Date(),
      });
    } catch (error) {
      console.error('CRITICAL: PHI access logging failed:', error);
      // Don't throw - logging failures shouldn't block operations
      // but should trigger alerts for compliance team
      return null;
    }
  }

  /**
   * Get access history for a patient
   */
  static async getPatientAccessHistory(patientId, options = {}) {
    const {
      days = 30,
      userId = null,
      accessType = null,
      limit = 100,
      offset = 0,
    } = options;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where = {
      patient_id: patientId,
      accessed_at: { [Op.gte]: since },
    };

    if (userId) where.user_id = userId;
    if (accessType) where.access_type = accessType;

    return await this.findAndCountAll({
      where,
      order: [['accessed_at', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get unusual access patterns (for security monitoring)
   */
  static async getUnusualAccessPatterns(hours = 24, threshold = 10) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const result = await sequelize.query(
      `
      SELECT 
        user_id,
        user_role,
        COUNT(DISTINCT patient_id) as unique_patients,
        COUNT(*) as total_accesses
      FROM phi_access_log
      WHERE accessed_at >= :since
      GROUP BY user_id, user_role
      HAVING unique_patients > :threshold
      ORDER BY unique_patients DESC
      LIMIT 50
      `,
      {
        replacements: { since, threshold },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    return result;
  }

  /**
   * Get access summary by type for a user
   */
  static async getUserAccessSummary(userId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await this.findAll({
      where: {
        user_id: userId,
        accessed_at: { [Op.gte]: since },
      },
      attributes: [
        'access_type',
        [sequelize.fn('COUNT', sequelize.col('access_id')), 'count'],
      ],
      group: ['access_type'],
      order: [[sequelize.literal('count'), 'DESC']],
    });
  }

  /**
   * Check if access was logged recently (prevent duplicate logs)
   */
  static async wasRecentlyLogged(userId, patientId, resourceId, minutes = 5) {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const recent = await this.findOne({
      where: {
        user_id: userId,
        patient_id: patientId,
        resource_id: resourceId,
        accessed_at: { [Op.gte]: since },
      },
    });

    return !!recent;
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
    user_role: {
      type: DataTypes.ENUM('patient', 'doctor', 'nurse', 'admin', 'staff'),
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
        'print',
        'view_medical_records',
        'view_appointment',
        'view_admission',
        'view_progress_notes',
        'view_prescriptions',
        'view_vitals',
        'view_diagnosis',
        'view_lab_results',
        'view_imaging',
        'biometric_authentication',
      ),
      allowNull: false,
    },
    resource_type: {
      type: DataTypes.ENUM(
        'medical_record',
        'appointment',
        'admission',
        'er_visit',
        'prescription',
        'lab_result',
        'progress_note',
        'vitals',
        'imaging',
        'diagnosis',
      ),
      allowNull: false,
    },
    resource_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    access_reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    access_method: {
      type: DataTypes.ENUM('web', 'mobile', 'api', 'export', 'print'),
      allowNull: false,
      defaultValue: 'web',
    },
    accessed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PHIAccessLog',
    tableName: 'phi_access_log',
    timestamps: false,
    indexes: [
      { name: 'idx_phi_patient_id', fields: ['patient_id'] },
      { name: 'idx_phi_user_id', fields: ['user_id'] },
      { name: 'idx_phi_staff_id', fields: ['staff_id'] },
      { name: 'idx_phi_accessed_at', fields: ['accessed_at'] },
      { name: 'idx_phi_access_type', fields: ['access_type'] },
      { name: 'idx_phi_patient_date', fields: ['patient_id', 'accessed_at'] },
      { name: 'idx_phi_user_patient', fields: ['user_id', 'patient_id'] },
    ],
  },
);

export default PHIAccessLog;
