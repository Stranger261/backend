import { DataTypes } from 'sequelize';
import sequelize from '../../config/db.config.js';

const AppointmentPayment = sequelize.define(
  'AppointmentPayment',
  {
    payment_id: {
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
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.ENUM(
        'cash',
        'credit_card',
        'debit_card',
        'gcash',
        'paymaya',
        'bank_transfer',
        'insurance'
      ),
      allowNull: false,
    },
    transaction_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    processed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    notes: {
      type: DataTypes.TEXT,
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
    tableName: 'appointment_payment',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_payment_appointment',
        fields: ['appointment_id'],
      },
      {
        name: 'idx_payment_status',
        fields: ['payment_status'],
      },
      {
        name: 'idx_payment_date',
        fields: ['paid_at'],
      },
    ],
  }
);

// Static method to get total paid amount
AppointmentPayment.getTotalPaid = async function (appointmentId) {
  try {
    const result = await this.findOne({
      where: {
        appointment_id: appointmentId,
        payment_status: 'completed',
      },
      attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']],
    });

    return parseFloat(result?.dataValues?.total || 0);
  } catch (error) {
    throw error;
  }
};

export default AppointmentPayment;
