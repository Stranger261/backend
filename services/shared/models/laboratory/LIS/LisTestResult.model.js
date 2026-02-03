import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';

class LisTestResult extends Model {
  static async getPendingResults() {
    return await this.findAll({
      where: {
        result_status: 'Pending',
      },
      include: [
        {
          association: 'order',
          include: [{ association: 'patient' }, { association: 'service' }],
        },
      ],
      order: [['result_date', 'ASC']],
    });
  }

  static async getCriticalResults(startDate, endDate) {
    return await this.findAll({
      where: {
        abnormal_flag: {
          [sequelize.Sequelize.Op.in]: ['Critical Low', 'Critical High'],
        },
        result_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          association: 'order',
          include: [{ association: 'patient' }],
        },
        { association: 'service' },
      ],
      order: [['result_date', 'DESC']],
    });
  }

  static async getResultsByPatient(patientId, limit = 50) {
    return await this.findAll({
      include: [
        {
          association: 'order',
          where: { patient_id: patientId },
          include: [{ association: 'service' }],
        },
      ],
      order: [
        ['result_date', 'DESC'],
        ['result_time', 'DESC'],
      ],
      limit,
    });
  }

  static async getResultsByTest(serviceId, startDate, endDate) {
    return await this.findAll({
      where: {
        service_id: serviceId,
        result_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          association: 'order',
          include: [{ association: 'patient' }],
        },
      ],
      order: [['result_date', 'DESC']],
    });
  }

  static async getAbnormalResults(startDate, endDate) {
    return await this.findAll({
      where: {
        abnormal_flag: {
          [sequelize.Sequelize.Op.ne]: 'Normal',
        },
        result_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          association: 'order',
          include: [{ association: 'patient' }],
        },
        { association: 'service' },
      ],
      order: [['result_date', 'DESC']],
    });
  }

  async verify(verifiedBy) {
    this.result_status = 'Final';
    this.verified_by = verifiedBy;
    this.verified_at = new Date();
    await this.save();

    // Check if all results for the order are verified
    const allResults = await LisTestResult.findAll({
      where: { order_id: this.order_id },
    });

    const allVerified = allResults.every(r => r.result_status === 'Final');

    if (allVerified) {
      const order = await sequelize.models.LisTestOrder.findByPk(this.order_id);
      if (order) {
        await order.markAsCompleted();
      }
    }
  }

  async correct(newValue, correctedBy) {
    this.result_value = newValue;
    this.result_status = 'Corrected';
    this.verified_by = correctedBy;
    this.verified_at = new Date();
    await this.save();
  }

  isCritical() {
    return ['Critical Low', 'Critical High'].includes(this.abnormal_flag);
  }

  isAbnormal() {
    return this.abnormal_flag !== 'Normal';
  }
}

LisTestResult.init(
  {
    result_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_test_orders',
        key: 'order_id',
      },
    },
    specimen_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_specimens',
        key: 'specimen_id',
      },
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_services',
        key: 'service_id',
      },
    },
    test_parameter: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'e.g., Glucose, Hemoglobin, WBC',
    },
    result_value: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    result_unit: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'e.g., mg/dL, g/dL, K/uL',
    },
    reference_range: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'e.g., 70-100 mg/dL',
    },
    abnormal_flag: {
      type: DataTypes.ENUM(
        'Normal',
        'Low',
        'High',
        'Critical Low',
        'Critical High',
      ),
      defaultValue: 'Normal',
    },
    result_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    result_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    performed_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    analyzer_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Lab instrument used',
    },
    result_status: {
      type: DataTypes.ENUM('Pending', 'Preliminary', 'Final', 'Corrected'),
      defaultValue: 'Pending',
    },
    verified_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'LisTestResult',
    tableName: 'lis_test_results',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_lis_result_order', fields: ['order_id'] },
      { name: 'idx_lis_result_specimen', fields: ['specimen_id'] },
      { name: 'idx_lis_result_service', fields: ['service_id'] },
      { name: 'idx_lis_result_status', fields: ['result_status'] },
      { name: 'idx_lis_result_abnormal', fields: ['abnormal_flag'] },
      { name: 'idx_lis_result_date', fields: ['result_date'] },
    ],
  },
);

export default LisTestResult;
