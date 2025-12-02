import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class ERVisit extends Model {
  static async getActiveERPatients() {
    return await this.findAll({
      where: {
        er_status: { [sequelize.Op.in]: ['waiting', 'in_treatment'] },
      },
      order: [
        ['triage_level', 'ASC'],
        ['arrival_time', 'ASC'],
      ],
    });
  }

  isCritical() {
    return this.triage_level === 1;
  }
}

ERVisit.init(
  {
    er_visit_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    er_number: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    arrival_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    arrival_mode: {
      type: DataTypes.ENUM(
        'ambulance',
        'walk_in',
        'police',
        'helicopter',
        'other'
      ),
      allowNull: false,
    },
    chief_complaint: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    accompanied_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    triage_level: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    triage_nurse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    er_status: {
      type: DataTypes.ENUM(
        'waiting',
        'in_treatment',
        'admitted',
        'discharged',
        'transferred',
        'left_ama',
        'deceased'
      ),
      defaultValue: 'waiting',
    },
    disposition_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    disposition_type: {
      type: DataTypes.ENUM(
        'home',
        'admitted',
        'transferred',
        'ama',
        'deceased'
      ),
      allowNull: true,
    },
    total_er_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ERVisit',
    tableName: 'er_visits',
    timestamps: false,
    indexes: [
      { name: 'idx_triage_level', fields: ['triage_level'] },
      { name: 'idx_er_number', fields: ['er_number'] },
      { name: 'idx_er_status', fields: ['er_status'] },
    ],
  }
);

export default ERVisit;
