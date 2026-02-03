import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';

class LisQualityControl extends Model {
  static async getFailedQC(startDate, endDate) {
    return await this.findAll({
      where: {
        status: 'Fail',
        qc_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [{ association: 'service' }],
      order: [
        ['qc_date', 'DESC'],
        ['qc_time', 'DESC'],
      ],
    });
  }

  static async getQCByAnalyzer(analyzerName, startDate, endDate) {
    return await this.findAll({
      where: {
        analyzer_name: analyzerName,
        qc_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [{ association: 'service' }],
      order: [
        ['qc_date', 'DESC'],
        ['qc_time', 'DESC'],
      ],
    });
  }

  static async getTodayQC() {
    const today = new Date().toISOString().split('T')[0];
    return await this.findAll({
      where: { qc_date: today },
      include: [{ association: 'service' }],
      order: [['qc_time', 'ASC']],
    });
  }

  static async getQCByService(serviceId, startDate, endDate) {
    return await this.findAll({
      where: {
        service_id: serviceId,
        qc_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      order: [
        ['qc_date', 'DESC'],
        ['qc_time', 'DESC'],
      ],
    });
  }

  static async getQCStatistics(startDate, endDate) {
    const results = await this.findAll({
      where: {
        qc_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('qc_id')), 'count'],
      ],
      group: ['status'],
    });

    return results.reduce((acc, result) => {
      acc[result.status] = parseInt(result.get('count'));
      return acc;
    }, {});
  }

  isPassed() {
    return this.status === 'Pass';
  }

  isFailed() {
    return this.status === 'Fail';
  }

  isWarning() {
    return this.status === 'Warning';
  }
}

LisQualityControl.init(
  {
    qc_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_services',
        key: 'service_id',
      },
    },
    qc_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    qc_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    analyzer_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    qc_level: {
      type: DataTypes.ENUM('Level 1', 'Level 2', 'Level 3'),
      allowNull: false,
      comment: 'QC control levels (low, normal, high)',
    },
    parameter_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    expected_value: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    observed_value: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Pass', 'Fail', 'Warning'),
      allowNull: false,
    },
    performed_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'LisQualityControl',
    tableName: 'lis_quality_control',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_lis_qc_service', fields: ['service_id'] },
      { name: 'idx_lis_qc_date', fields: ['qc_date'] },
      { name: 'idx_lis_qc_analyzer', fields: ['analyzer_name'] },
      { name: 'idx_lis_qc_status', fields: ['status'] },
    ],
  },
);

export default LisQualityControl;
