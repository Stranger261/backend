import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class DoctorPatientAssignment extends Model {
  static async isAssigned(doctorId, patientId) {
    const assignment = await this.findOne({
      where: { doctor_id: doctorId, patient_id: patientId, active: true },
    });
    return !!assignment;
  }

  static async assignDoctor(doctorId, patientId, assignmentType, assignedBy) {
    return await this.create({
      doctor_id: doctorId,
      patient_id: patientId,
      assignment_type: assignmentType,
      assigned_by: assignedBy,
      active: true,
    });
  }
}

DoctorPatientAssignment.init(
  {
    assignment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assignment_type: {
      type: DataTypes.ENUM('primary', 'consulting', 'covering', 'emergency'),
      allowNull: false,
    },
    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assigned_date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DoctorPatientAssignment',
    tableName: 'doctor_patient_assignments',
    timestamps: false,
  }
);

export default DoctorPatientAssignment;
