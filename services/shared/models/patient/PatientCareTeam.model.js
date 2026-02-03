import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PatientCareTeam extends Model {
  /**
   * Check if staff is part of patient's care team
   */
  static async isOnCareTeam(patientId, staffId) {
    const membership = await this.findOne({
      where: {
        patient_id: patientId,
        staff_id: staffId,
        is_active: true,
      },
    });

    if (!membership) return false;

    // Check if ended
    if (membership.end_date && new Date(membership.end_date) < new Date()) {
      await membership.update({ is_active: false });
      return false;
    }

    return true;
  }

  /**
   * Get active care team for a patient
   */
  static async getActiveCareTeam(patientId) {
    return await this.findAll({
      where: {
        patient_id: patientId,
        is_active: true,
      },
      order: [['start_date', 'DESC']],
    });
  }

  /**
   * Add member to care team
   */
  static async addToTeam(
    patientId,
    staffId,
    roleInCare,
    assignedBy,
    reason = null,
  ) {
    // Check if already on team
    const existing = await this.findOne({
      where: {
        patient_id: patientId,
        staff_id: staffId,
        is_active: true,
      },
    });

    if (existing) {
      // Update role if different
      if (existing.role_in_care !== roleInCare) {
        return await existing.update({
          role_in_care: roleInCare,
          assignment_reason: reason,
        });
      }
      return existing;
    }

    return await this.create({
      patient_id: patientId,
      staff_id: staffId,
      role_in_care: roleInCare,
      is_active: true,
      start_date: new Date(),
      assigned_by: assignedBy,
      assignment_reason: reason,
    });
  }

  /**
   * Remove member from care team
   */
  static async removeFromTeam(patientId, staffId) {
    const [affectedRows] = await this.update(
      {
        is_active: false,
        end_date: new Date(),
      },
      {
        where: {
          patient_id: patientId,
          staff_id: staffId,
          is_active: true,
        },
      },
    );

    return affectedRows > 0;
  }

  /**
   * Get all patients for a staff member
   */
  static async getStaffPatients(staffId) {
    return await this.findAll({
      where: {
        staff_id: staffId,
        is_active: true,
      },
      order: [['start_date', 'DESC']],
    });
  }

  /**
   * Get care team history for a patient
   */
  static async getCareTeamHistory(patientId) {
    return await this.findAll({
      where: {
        patient_id: patientId,
      },
      order: [['start_date', 'DESC']],
    });
  }

  /**
   * Transfer primary physician
   */
  static async transferPrimaryPhysician(
    patientId,
    oldStaffId,
    newStaffId,
    assignedBy,
    reason,
  ) {
    // End old physician's assignment
    await this.removeFromTeam(patientId, oldStaffId);

    // Add new physician
    return await this.addToTeam(
      patientId,
      newStaffId,
      'primary_physician',
      assignedBy,
      reason,
    );
  }

  /**
   * Get primary physician for patient
   */
  static async getPrimaryPhysician(patientId) {
    return await this.findOne({
      where: {
        patient_id: patientId,
        role_in_care: 'primary_physician',
        is_active: true,
      },
    });
  }
}

PatientCareTeam.init(
  {
    care_team_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    staff_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role_in_care: {
      type: DataTypes.ENUM(
        'primary_physician',
        'consulting_physician',
        'primary_nurse',
        'specialist',
        'therapist',
        'case_manager',
      ),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assignment_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PatientCareTeam',
    tableName: 'patient_care_teams',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_care_team_patient', fields: ['patient_id'] },
      { name: 'idx_care_team_staff', fields: ['staff_id'] },
      { name: 'idx_care_team_active', fields: ['is_active'] },
      {
        name: 'idx_care_team_patient_active',
        fields: ['patient_id', 'is_active'],
      },
      {
        name: 'idx_care_team_staff_active',
        fields: ['staff_id', 'is_active'],
      },
    ],
  },
);

export default PatientCareTeam;
