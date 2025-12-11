import { DataTypes } from 'sequelize';
import sequelize from '../../config/db.config.js';

const AppointmentHistory = sequelize.define(
  'AppointmentHistory',
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
        model: 'appointment',
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
      references: {
        model: 'user',
        key: 'user_id',
      },
    },
    change_reason: {
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
    tableName: 'appointment_history',
    timestamps: false,
    indexes: [
      {
        name: 'idx_appointment_history_appointment',
        fields: ['appointment_id'],
      },
      {
        name: 'idx_appointment_history_created',
        fields: ['created_at'],
      },
    ],
  }
);

export default AppointmentHistory;
