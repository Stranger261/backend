import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';
import Staff from '../ibms/Staff.model.js';

class Appointment extends Model {
  static async getTodaysAppointments() {
    const today = new Date().toISOString().split('T')[0];
    return await this.findAll({
      where: { appointment_date: today },
      order: [['start_time', 'ASC']],
    });
  }

  /**
   * Check if time slot conflicts with existing appointments
   */
  static async hasConflict(
    doctorUuid,
    appointmentDate,
    startTime,
    excludeAppointmentId = null
  ) {
    const doctor = await Staff.findOne({ where: { staff_uuid: doctorUuid } });

    if (!doctor) {
      throw new Error('Doctor not found');
    }

    const where = {
      doctor_id: doctor.staff_id,
      appointment_date: appointmentDate,
      start_time: startTime,
      status: ['scheduled', 'confirmed', 'checked_in', 'in_progress'],
    };

    if (excludeAppointmentId) {
      where.appointment_id = {
        [sequelize.Sequelize.Op.ne]: excludeAppointmentId,
      };
    }

    const existing = await this.findOne({ where });
    return !!existing;
  }

  // Status checking methods
  canCancel() {
    return ['scheduled', 'confirmed'].includes(this.status);
  }

  canReschedule() {
    return ['scheduled', 'confirmed'].includes(this.status);
  }

  canCheckIn() {
    return ['scheduled', 'confirmed'].includes(this.status);
  }

  canExtend() {
    return ['in_progress', 'checked_in'].includes(this.status);
  }

  canComplete() {
    return ['checked_in', 'in_progress'].includes(this.status);
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
      references: {
        model: 'patients',
        key: 'patient_id',
      },
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'departments',
        key: 'department_id',
      },
    },
    appointment_type: {
      type: DataTypes.ENUM('consultation', 'followup', 'procedure', 'checkup'),
      allowNull: false,
      defaultValue: 'consultation',
    },
    is_online_consultation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    video_consultation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    appointment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    appointment_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'Legacy field, use start_time instead',
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
    },
    time_extended_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Minutes extended beyond base duration',
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
    priority: {
      type: DataTypes.ENUM('normal', 'urgent', 'emergency'),
      defaultValue: 'normal',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    consultation_fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 500.0,
      comment: 'Base consultation fee',
    },
    extension_fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: 'Fee for extended time',
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 500.0,
      comment: 'Total fee (consultation + extension)',
    },
    payment_status: {
      type: DataTypes.ENUM(
        'pending',
        'partial',
        'paid',
        'refunded',
        'cancelled'
      ),
      defaultValue: 'pending',
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'user_id or staff_id who created the appointment',
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
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
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_appointment_number', fields: ['appointment_number'] },
      { name: 'idx_doctor_date', fields: ['doctor_id', 'appointment_date'] },
      { name: 'idx_patient_id', fields: ['patient_id'] },
      { name: 'idx_status', fields: ['status'] },
      { name: 'idx_payment_status', fields: ['payment_status'] },
    ],
  }
);

export default Appointment;
