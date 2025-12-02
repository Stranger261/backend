import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

/**
 * AppointmentHistory Model
 * Tracks all changes made to appointments (audit trail)
 */
class AppointmentHistory extends Model {
  static async getAppointmentHistory(appointmentId) {
    return await this.findAll({
      where: { appointment_id: appointmentId },
      order: [['created_at', 'DESC']],
    });
  }
}

AppointmentHistory.init(
  {
    history_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'appointments',
        key: 'appointment_id',
      },
    },
    action_type: {
      type: DataTypes.ENUM(
        'created',
        'updated',
        'cancelled',
        'rescheduled',
        'checked_in',
        'completed',
        'no_show'
      ),
      allowNull: false,
    },
    previous_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    new_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    previous_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    new_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    previous_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    new_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    changed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'user_id or staff_id who made the change',
    },
    change_reason: {
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
    modelName: 'AppointmentHistory',
    tableName: 'appointment_history',
    timestamps: false,
    indexes: [
      {
        name: 'idx_appointment_id',
        fields: ['appointment_id'],
      },
      {
        name: 'idx_action_type',
        fields: ['action_type'],
      },
      {
        name: 'idx_created_at',
        fields: ['created_at'],
      },
    ],
  }
);

export default AppointmentHistory;
