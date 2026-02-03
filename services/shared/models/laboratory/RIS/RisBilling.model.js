import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';

class RisBilling extends Model {
  static async getPendingClaims() {
    return await this.findAll({
      where: {
        claim_status: 'Pending',
      },
      include: [
        { association: 'patient' },
        { association: 'service' },
        { association: 'study' },
      ],
      order: [['billing_date', 'ASC']],
    });
  }

  static async getUnpaidBills() {
    return await this.findAll({
      where: {
        payment_status: ['Unpaid', 'Partially Paid'],
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [['billing_date', 'ASC']],
    });
  }

  static async getRevenueByDateRange(startDate, endDate) {
    const result = await this.findAll({
      where: {
        billing_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
        payment_status: 'Paid',
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_revenue'],
        [sequelize.fn('COUNT', sequelize.col('billing_id')), 'total_bills'],
      ],
    });
    return result[0];
  }

  static async getBillingByInsurance(insuranceCompany, startDate, endDate) {
    return await this.findAll({
      where: {
        insurance_company: insuranceCompany,
        billing_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [['billing_date', 'DESC']],
    });
  }

  async submitClaim() {
    this.claim_status = 'Submitted';
    await this.save();
  }

  async approveClaim() {
    this.claim_status = 'Approved';
    await this.save();
  }

  async denyClaim() {
    this.claim_status = 'Denied';
    await this.save();
  }

  async recordPayment(amount) {
    const remainingAmount = parseFloat(this.amount) - amount;

    if (remainingAmount <= 0) {
      this.payment_status = 'Paid';
      this.claim_status = 'Paid';
    } else {
      this.payment_status = 'Partially Paid';
    }

    await this.save();
  }
}

RisBilling.init(
  {
    billing_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    study_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ris_imaging_studies',
        key: 'study_id',
      },
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
    billing_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    procedure_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'CPT code',
    },
    icd_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Diagnosis code',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    insurance_company: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    insurance_policy: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    claim_status: {
      type: DataTypes.ENUM(
        'Pending',
        'Submitted',
        'Approved',
        'Denied',
        'Paid',
      ),
      defaultValue: 'Pending',
    },
    payment_status: {
      type: DataTypes.ENUM('Unpaid', 'Partially Paid', 'Paid'),
      defaultValue: 'Unpaid',
    },
  },
  {
    sequelize,
    modelName: 'RisBilling',
    tableName: 'ris_billing',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_ris_billing_study', fields: ['study_id'] },
      { name: 'idx_ris_billing_patient', fields: ['patient_id'] },
      { name: 'idx_ris_billing_date', fields: ['billing_date'] },
      { name: 'idx_ris_billing_claim_status', fields: ['claim_status'] },
      { name: 'idx_ris_billing_payment_status', fields: ['payment_status'] },
    ],
  },
);

export default RisBilling;
