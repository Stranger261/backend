import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class ConsentRestriction extends Model {
  /**
   * Check if staff member is restricted from accessing patient
   */
  static async isRestricted(patientId, staffId) {
    const restriction = await this.findOne({
      where: {
        patient_id: patientId,
        restricted_staff_id: staffId,
        is_active: true,
      },
    });

    if (!restriction) return { isRestricted: false };

    // Check if expired
    if (
      restriction.expiry_date &&
      new Date(restriction.expiry_date) < new Date()
    ) {
      await restriction.update({ is_active: false });
      return { isRestricted: false };
    }

    return {
      isRestricted: true,
      restrictionType: restriction.restriction_type,
      reason: restriction.restriction_reason,
    };
  }

  /**
   * Add restriction
   */
  static async addRestriction(
    patientId,
    staffId,
    restrictionType,
    reason,
    createdBy,
    expiryDate = null,
  ) {
    return await this.create({
      patient_id: patientId,
      restricted_staff_id: staffId,
      restriction_type: restrictionType,
      restriction_reason: reason,
      is_active: true,
      effective_date: new Date(),
      expiry_date: expiryDate,
      created_by: createdBy,
    });
  }

  /**
   * Remove restriction
   */
  static async removeRestriction(patientId, staffId) {
    const [affectedRows] = await this.update(
      { is_active: false },
      {
        where: {
          patient_id: patientId,
          restricted_staff_id: staffId,
          is_active: true,
        },
      },
    );

    return affectedRows > 0;
  }

  /**
   * Get all active restrictions for a patient
   */
  static async getPatientRestrictions(patientId) {
    return await this.findAll({
      where: {
        patient_id: patientId,
        is_active: true,
      },
      order: [['effective_date', 'DESC']],
    });
  }

  /**
   * Get all patients who restricted a specific staff member
   */
  static async getRestrictedPatients(staffId) {
    return await this.findAll({
      where: {
        restricted_staff_id: staffId,
        is_active: true,
      },
      order: [['effective_date', 'DESC']],
    });
  }

  /**
   * Check department restriction
   */
  static async isDepartmentRestricted(patientId, department) {
    const restriction = await this.findOne({
      where: {
        patient_id: patientId,
        restricted_department: department,
        is_active: true,
      },
    });

    if (!restriction) return { isRestricted: false };

    // Check if expired
    if (
      restriction.expiry_date &&
      new Date(restriction.expiry_date) < new Date()
    ) {
      await restriction.update({ is_active: false });
      return { isRestricted: false };
    }

    return {
      isRestricted: true,
      restrictionType: restriction.restriction_type,
      reason: restriction.restriction_reason,
    };
  }
}

ConsentRestriction.init(
  {
    restriction_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    restricted_staff_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    restricted_department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    restriction_type: {
      type: DataTypes.ENUM(
        'full_block',
        'require_approval',
        'notification_only',
      ),
      allowNull: false,
      defaultValue: 'full_block',
    },
    restriction_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    effective_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ConsentRestriction',
    tableName: 'consent_restrictions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_restriction_patient', fields: ['patient_id'] },
      { name: 'idx_restriction_staff', fields: ['restricted_staff_id'] },
      { name: 'idx_restriction_active', fields: ['is_active'] },
      {
        name: 'idx_restriction_patient_staff',
        fields: ['patient_id', 'restricted_staff_id', 'is_active'],
      },
    ],
  },
);

export default ConsentRestriction;
