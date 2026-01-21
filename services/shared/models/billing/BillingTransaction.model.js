import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class BillingTransaction extends Model {
  static async generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastInvoice = await this.findOne({
      where: {
        invoice_number: {
          [sequelize.Sequelize.Op.like]: `INV-${year}${month}%`,
        },
      },
      order: [['transaction_id', 'DESC']],
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastNum = parseInt(lastInvoice.invoice_number.split('-')[2]);
      sequence = lastNum + 1;
    }

    return `INV-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }

  static async getPatientBalance(patientId) {
    const transactions = await this.findAll({
      where: {
        patient_id: patientId,
        payment_status: ['pending', 'partial'],
      },
    });

    return transactions.reduce((total, txn) => {
      return (
        total + (parseFloat(txn.amount) - parseFloat(txn.paid_amount || 0))
      );
    }, 0);
  }

  getRemainingBalance() {
    return parseFloat(this.amount) - parseFloat(this.paid_amount || 0);
  }

  markAsPaid(paymentMethod) {
    this.payment_status = 'paid';
    this.paid_amount = this.amount;
    this.payment_method = paymentMethod;
    return this.save();
  }
}

BillingTransaction.init(
  {
    transaction_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_number: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'patient',
        key: 'patient_id',
      },
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'appointments',
        key: 'appointment_id',
      },
    },
    admission_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admissions',
        key: 'admission_id',
      },
    },
    transaction_type: {
      type: DataTypes.ENUM(
        'consultation',
        'procedure',
        'lab',
        'imaging',
        'medication',
        'room',
        'other'
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'partial', 'cancelled'),
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.ENUM('cash', 'card', 'insurance', 'bank_transfer'),
      allowNull: true,
    },
    paid_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    transaction_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Record creation timestamp',
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Record update timestamp',
    },
  },
  {
    sequelize,
    modelName: 'BillingTransaction',
    tableName: 'billing_transactions',
    timestamps: false,
    indexes: [
      { name: 'idx_billing_created', fields: ['created_at'] },
      { name: 'idx_billing_updated', fields: ['created_at'] },
      { name: 'idx_billing_invoice', fields: ['invoice_number'] },
      { name: 'idx_billing_patient', fields: ['patient_id'] },
      { name: 'idx_billing_status', fields: ['payment_status'] },
    ],
    hooks: {
      beforeCreate: async transaction => {
        if (!transaction.invoice_number) {
          transaction.invoice_number =
            await BillingTransaction.generateInvoiceNumber();
        }
      },
    },
  }
);

export default BillingTransaction;
