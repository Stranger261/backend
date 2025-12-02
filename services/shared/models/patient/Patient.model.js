import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Patient extends Model {
  static async findByMRN(mrn) {
    return await this.findOne({ where: { mrn } });
  }

  isActive() {
    return this.patient_status === 'active';
  }
}

Patient.init(
  {
    patient_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    mrn: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: true,
    },
    person_id: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
    },
    patient_status: {
      type: DataTypes.ENUM('active', 'inactive', 'deceased'),
      defaultValue: 'active',
    },
    first_visit_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    primary_doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    registration_type: {
      type: DataTypes.ENUM('online', 'walk_in', 'emergency', 'referral'),
      allowNull: false,
    },
    insurance_provider: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    insurance_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    insurance_expiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Patient',
    tableName: 'patient',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_mrn', fields: ['mrn'] },
      { name: 'idx_patient_status', fields: ['patient_status'] },
    ],
  }
);

export default Patient;
