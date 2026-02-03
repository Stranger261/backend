import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';
import IdSequence from '../../ibms/IdSequence.model.js';

class RisImagingStudy extends Model {
  static async generateAccessionNumber() {
    return await IdSequence.getNextValue('ris_accession');
  }

  static async getStudiesByPatient(patientId, limit = 10) {
    return await this.findAll({
      where: { patient_id: patientId },
      include: [{ association: 'service' }, { association: 'appointment' }],
      order: [
        ['study_date', 'DESC'],
        ['study_time', 'DESC'],
      ],
      limit,
    });
  }

  static async getPendingStudies() {
    return await this.findAll({
      where: {
        status: ['Scheduled', 'In Progress'],
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [
        ['study_date', 'ASC'],
        ['study_time', 'ASC'],
      ],
    });
  }

  static async getUnreportedStudies() {
    return await this.findAll({
      where: {
        status: 'Completed',
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [['study_date', 'ASC']],
    });
  }

  static async getStudiesByModality(modality, startDate, endDate) {
    return await this.findAll({
      where: {
        modality,
        study_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [{ association: 'patient' }],
      order: [['study_date', 'DESC']],
    });
  }

  async markAsCompleted(imageCount, pacsLocation) {
    this.status = 'Completed';
    this.image_count = imageCount;
    this.pacs_location = pacsLocation;
    await this.save();
  }

  async assignRadiologist(radiologist) {
    this.radiologist = radiologist;
    await this.save();
  }
}

RisImagingStudy.init(
  {
    study_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    accession_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'ris_appointments',
        key: 'appointment_id',
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
    study_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    study_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    modality: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'CT, MR, XR, US, etc.',
    },
    body_part: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    study_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    technologist: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    radiologist: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'Scheduled',
        'In Progress',
        'Completed',
        'Reported',
        'Verified',
      ),
      defaultValue: 'Scheduled',
    },
    image_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    pacs_location: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'PACS storage location',
    },
  },
  {
    sequelize,
    modelName: 'RisImagingStudy',
    tableName: 'ris_imaging_studies',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_ris_study_accession',
        fields: ['accession_number'],
        unique: true,
      },
      { name: 'idx_ris_study_date', fields: ['study_date'] },
      { name: 'idx_ris_study_patient', fields: ['patient_id'] },
      { name: 'idx_ris_study_status', fields: ['status'] },
      { name: 'idx_ris_study_modality', fields: ['modality'] },
    ],
    hooks: {
      beforeCreate: async study => {
        if (!study.accession_number) {
          study.accession_number =
            await RisImagingStudy.generateAccessionNumber();
        }
      },
    },
  },
);

export default RisImagingStudy;
