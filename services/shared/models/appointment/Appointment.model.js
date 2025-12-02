import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Appointment extends Model {
  static async getTodaysAppointments() {
    const today = new Date().toISOString().split('T')[0];
    return await this.findAll({
      where: { appointment_date: today },
      order: [['appointment_time', 'ASC']],
    });
  }

  canCancel() {
    return ['scheduled', 'confirmed'].includes(this.status);
  }
}

Appointment.init(
  {
    appointment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_number: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    appointment_type: {
      type: DataTypes.ENUM('consultation', 'followup', 'procedure', 'checkup'),
      allowNull: false,
    },
    appointment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    appointment_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
    },
    status: {
      type: DataTypes.ENUM(
        'scheduled',
        'confirmed',
        'checked_in',
        'in_progress',
        'completed',
        'cancelled',
        'no_show'
      ),
      defaultValue: 'scheduled',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_doctor_date', fields: ['doctor_id', 'appointment_date'] },
      { name: 'idx_appointment_number', fields: ['appointment_number'] },
    ],
  }
);

export default Appointment;
