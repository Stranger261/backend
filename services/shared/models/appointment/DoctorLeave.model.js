import { DataTypes } from 'sequelize';
import sequelize from '../../config/db.config.js';

const DoctorLeave = sequelize.define(
  'DoctorLeave',
  {
    leave_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    staff_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    leave_type: {
      type: DataTypes.ENUM(
        'vacation',
        'sick_leave',
        'conference',
        'personal',
        'emergency'
      ),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'doctor_leave',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_leave_staff',
        fields: ['staff_id'],
      },
      {
        name: 'idx_leave_dates',
        fields: ['start_date', 'end_date'],
      },
      {
        name: 'idx_leave_status',
        fields: ['status'],
      },
    ],
  }
);

export default DoctorLeave;
