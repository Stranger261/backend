import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';
import IdSequence from '../../ibms/IdSequence.model.js';

class RisAppointment extends Model {
  static async generateAppointmentNumber() {
    return await IdSequence.getNextValue('appointment');
  }

  static async getScheduledAppointments(date) {
    return await this.findAll({
      where: {
        appointment_date: date,
        status: ['Scheduled', 'Confirmed'],
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [['appointment_time', 'ASC']],
    });
  }

  static async getTodayAppointments() {
    const today = new Date().toISOString().split('T')[0];
    return await this.getScheduledAppointments(today);
  }

  static async getUpcomingAppointments(patientId) {
    const today = new Date().toISOString().split('T')[0];
    return await this.findAll({
      where: {
        patient_id: patientId,
        appointment_date: {
          [sequelize.Sequelize.Op.gte]: today,
        },
        status: ['Scheduled', 'Confirmed'],
      },
      include: [{ association: 'service' }],
      order: [
        ['appointment_date', 'ASC'],
        ['appointment_time', 'ASC'],
      ],
    });
  }

  static async getPendingAppointments() {
    return await this.findAll({
      where: {
        status: ['Scheduled', 'Confirmed', 'In Progress'],
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [
        ['priority', 'DESC'],
        ['appointment_date', 'ASC'],
        ['appointment_time', 'ASC'],
      ],
    });
  }

  static async checkAvailability(date, time, serviceId) {
    const appointment = await this.findOne({
      where: {
        appointment_date: date,
        appointment_time: time,
        service_id: serviceId,
        status: ['Scheduled', 'Confirmed', 'In Progress'],
      },
    });
    return !appointment;
  }

  async markAsCompleted() {
    this.status = 'Completed';
    await this.save();
  }

  async cancel(reason) {
    this.status = 'Cancelled';
    this.special_instructions = `Cancelled: ${reason}`;
    await this.save();
  }
}

RisAppointment.init(
  {
    appointment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_number: {
      type: DataTypes.STRING(40),
      unique: true,
      allowNull: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ris_patients',
        key: 'patient_id',
      },
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ris_services',
        key: 'service_id',
      },
    },
    appointment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    appointment_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    referring_physician: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'Scheduled',
        'Confirmed',
        'In Progress',
        'Completed',
        'Cancelled',
        'No Show',
      ),
      defaultValue: 'Scheduled',
    },
    priority: {
      type: DataTypes.ENUM('Routine', 'Urgent', 'STAT'),
      defaultValue: 'Routine',
    },
    clinical_indication: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    special_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'RisAppointment',
    tableName: 'ris_appointments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_ris_appointment_number', fields: ['appointment_number'] },
      { name: 'idx_ris_appointment_date', fields: ['appointment_date'] },
      { name: 'idx_ris_appointment_status', fields: ['status'] },
      { name: 'idx_ris_appointment_patient', fields: ['patient_id'] },
      { name: 'idx_ris_appointment_priority', fields: ['priority'] },
    ],
    hooks: {
      beforeCreate: async appointment => {
        if (!appointment.appointment_number) {
          appointment.appointment_number =
            await RisAppointment.generateAppointmentNumber();
        }
      },
    },
  },
);

export default RisAppointment;
