import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Admission extends Model {
  static async getActiveAdmissions() {
    return await this.findAll({
      where: { admission_status: 'active' },
      order: [['admission_date', 'DESC']],
    });
  }

  getLengthOfStay() {
    if (this.discharge_date) {
      const diff = this.discharge_date - this.admission_date;
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    const diff = new Date() - this.admission_date;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}

Admission.init(
  {
    admission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admission_number: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    admission_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    admission_type: {
      type: DataTypes.ENUM('elective', 'emergency', 'transfer', 'delivery'),
      allowNull: false,
    },
    admission_source: {
      type: DataTypes.ENUM('er', 'outpatient', 'referral', 'direct'),
      allowNull: false,
    },
    attending_doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    diagnosis_at_admission: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    expected_discharge_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    admission_status: {
      type: DataTypes.ENUM('active', 'discharged', 'transferred', 'deceased'),
      defaultValue: 'active',
    },
    discharge_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    discharge_type: {
      type: DataTypes.ENUM(
        'routine',
        'against_advice',
        'transferred',
        'deceased'
      ),
      allowNull: true,
    },
    discharge_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    length_of_stay_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Admission',
    tableName: 'admissions',
    timestamps: false,
    indexes: [
      { name: 'idx_admission_number', fields: ['admission_number'] },
      { name: 'idx_patient_id', fields: ['patient_id'] },
    ],
  }
);

export default Admission;
