import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class MedicalRecord extends Model {
  static async getPatientHistory(patientId, limit = 10) {
    return await this.findAll({
      where: { patient_id: patientId },
      order: [['record_date', 'DESC']],
      limit,
    });
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
    },
    visit_type: {
      type: DataTypes.ENUM('appointment', 'admission', 'er_visit'),
      allowNull: true,
    },
    visit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    record_type: {
      type: DataTypes.ENUM(
        'consultation',
        'lab_result',
        'imaging',
        'diagnosis',
        'procedure'
      ),
      allowNull: false,
    },
    record_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
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
    prescription: {
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
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_patient_date', fields: ['patient_id', 'record_date'] },
    ],
  }
);

export default MedicalRecord;
