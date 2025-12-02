import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

/**
 * AppointmentPayment Model
 * Tracks all payments made for appointments
 * Supports partial payments
 */
class AppointmentPayment extends Model {
  /**
   * Get total paid amount for an appointment
   */
  static async getTotalPaid(appointmentId) {
    const result = await this.findOne({
      where: {
        appointment_id: appointmentId,
        payment_status: 'completed',
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_paid'],
      ],
    });

    return parseFloat(result?.dataValues?.total_paid || 0);
  }

  /**
   * Get all payments for an appointment
   */
  static async getAppointmentPayments(appointmentId) {
    return await this.findAll({
      where: { appointment_id: appointmentId },
      order: [['paid_at', 'DESC']],
    });
  }
}

AppointmentPayment.init(
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
        'bank_transfer'
      ),
      allowNull: false,
      defaultValue: 'cash',
    },
    transaction_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'External payment reference number',
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending',
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    processed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'staff_id who processed the payment',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
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
    modelName: 'AppointmentPayment',
    tableName: 'appointment_payments',
    timestamps: false,
    indexes: [
      {
        name: 'idx_appointment_id',
        fields: ['appointment_id'],
      },
      {
        name: 'idx_payment_status',
        fields: ['payment_status'],
      },
      {
        name: 'idx_transaction_ref',
        fields: ['transaction_reference'],
      },
    ],
  }
);

export default AppointmentPayment;
