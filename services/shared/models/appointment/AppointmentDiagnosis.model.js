import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AppointmentDiagnosis extends Model {
  static async getByAppointment(appointmentId) {
    return await this.findOne({
      where: { appointment_id: appointmentId },
      include: [{ association: 'appointment' }, { association: 'createdBy' }],
    });
  }

  requiresAdmission() {
    return this.disposition === 'admit' || this.requires_admission === true;
  }

  requiresFollowup() {
    return this.disposition === 'followup' || this.requires_followup === true;
  }
}

AppointmentDiagnosis.init(
  {
    diagnosis_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'appointments',
        key: 'appointment_id',
      },
    },
    // Assessment
    chief_complaint: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    history_of_present_illness: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'HPI',
    },
    physical_examination: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'PE findings',
    },
    // Diagnosis
    primary_diagnosis: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    icd_10_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    secondary_diagnoses: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Plan
    treatment_plan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    procedures_performed: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Disposition
    disposition: {
      type: DataTypes.ENUM('home', 'admit', 'refer', 'followup', 'er'),
      allowNull: false,
    },
    disposition_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Admission Decision
    requires_admission: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    admission_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    estimated_stay_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Follow-up
    requires_followup: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    followup_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    followup_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Metadata
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Doctor staff_id',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'AppointmentDiagnosis',
    tableName: 'appointment_diagnosis',
    timestamps: false,
    indexes: [
      {
        name: 'idx_appointment_diagnosis_appointment',
        fields: ['appointment_id'],
      },
      { name: 'idx_appointment_diagnosis_created_by', fields: ['created_by'] },
      {
        name: 'idx_appointment_diagnosis_disposition',
        fields: ['disposition'],
      },
    ],
  }
);

export default AppointmentDiagnosis;
