import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class MedicalRecord extends Model {
  static async getPatientHistory(patientId, options = {}) {
    const { limit = 50, recordType = null } = options;

    const where = { patient_id: patientId };
    if (recordType) {
      where.record_type = recordType;
    }

    return await this.findAll({
      where,
      include: [{ association: 'patient' }, { association: 'doctor' }],
      order: [['record_date', 'DESC']],
      limit,
    });
  }

  static async getByVisit(visitType, visitId) {
    return await this.findAll({
      where: {
        visit_type: visitType,
        visit_id: visitId,
      },
      include: [{ association: 'doctor' }],
      order: [['record_date', 'DESC']],
    });
  }

  static async getByAppointment(appointmentId) {
    return await this.getByVisit('appointment', appointmentId);
  }

  static async getByAdmission(admissionId) {
    return await this.getByVisit('admission', admissionId);
  }

  isAppointmentRecord() {
    return this.visit_type === 'appointment';
  }

  isAdmissionRecord() {
    return this.visit_type === 'admission';
  }

  isERVisitRecord() {
    return this.visit_type === 'er_visit';
  }
}

MedicalRecord.init(
  {
    record_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'patient_id',
      },
    },
    visit_type: {
      type: DataTypes.ENUM('appointment', 'admission', 'er_visit'),
      allowNull: true,
      comment: 'Type of visit this record is associated with',
    },
    visit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'appointment_id or admission_id depending on visit_type',
    },
    record_type: {
      type: DataTypes.ENUM(
        'consultation',
        'lab_result',
        'imaging',
        'diagnosis',
        'procedure',
      ),
      allowNull: false,
      comment: 'Type of medical record',
    },
    record_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    // Clinical data
    chief_complaint: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    treatment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'MedicalRecord',
    tableName: 'medical_records',
    timestamps: false,
    indexes: [
      {
        name: 'idx_medical_records_patient',
        fields: ['patient_id'],
      },
      {
        name: 'idx_medical_records_visit',
        fields: ['visit_type', 'visit_id'],
      },
      {
        name: 'idx_medical_records_doctor',
        fields: ['doctor_id'],
      },
      {
        name: 'idx_medical_records_date',
        fields: ['record_date'],
      },
    ],
  },
);

export default MedicalRecord;
