import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';

class RisReport extends Model {
  static async getPendingReports() {
    return await this.findAll({
      where: {
        report_status: ['Draft', 'Preliminary'],
      },
      include: [
        {
          association: 'study',
          include: [{ association: 'patient' }, { association: 'service' }],
        },
      ],
      order: [['report_date', 'ASC']],
    });
  }

  static async getCriticalReports(startDate, endDate) {
    return await this.findAll({
      where: {
        critical_result: true,
        report_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          association: 'study',
          include: [{ association: 'patient' }],
        },
      ],
      order: [['report_date', 'DESC']],
    });
  }

  static async getReportsByRadiologist(radiologist, startDate, endDate) {
    return await this.findAll({
      where: {
        radiologist,
        report_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          association: 'study',
          include: [{ association: 'patient' }],
        },
      ],
      order: [['report_date', 'DESC']],
    });
  }

  async finalize(verifiedBy) {
    this.report_status = 'Final';
    this.verified_by = verifiedBy;
    this.verified_at = new Date();
    await this.save();

    // Update study status
    const study = await sequelize.models.RisImagingStudy.findByPk(
      this.study_id,
    );
    if (study) {
      study.status = 'Reported';
      await study.save();
    }
  }

  async amend(newFindings, newImpression) {
    this.report_status = 'Amended';
    this.findings = newFindings;
    this.impression = newImpression;
    await this.save();
  }

  async markAsCritical() {
    this.critical_result = true;
    await this.save();
  }
}

RisReport.init(
  {
    report_id: {
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
    radiologist: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    report_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    report_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    findings: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    impression: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    recommendations: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    critical_result: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    report_status: {
      type: DataTypes.ENUM('Draft', 'Preliminary', 'Final', 'Amended'),
      defaultValue: 'Draft',
    },
    dictated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verified_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'RisReport',
    tableName: 'ris_reports',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_ris_report_study', fields: ['study_id'] },
      { name: 'idx_ris_report_status', fields: ['report_status'] },
      { name: 'idx_ris_report_date', fields: ['report_date'] },
      { name: 'idx_ris_report_critical', fields: ['critical_result'] },
      { name: 'idx_ris_report_radiologist', fields: ['radiologist'] },
    ],
  },
);

export default RisReport;
