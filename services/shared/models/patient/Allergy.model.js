import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Allergy extends Model {
  static async getPatientAllergies(patientId) {
    return await this.findAll({
      where: { patient_id: patientId },
      order: [['severity', 'DESC']],
    });
  }

  isCritical() {
    return this.severity === 'life_threatening' || this.severity === 'severe';
  }
}

Allergy.init(
  {
    allergy_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    allergen: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    allergy_type: {
      type: DataTypes.ENUM('medication', 'food', 'environmental', 'other'),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('mild', 'moderate', 'severe', 'life_threatening'),
      allowNull: false,
    },
    reaction: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reported_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reported_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Allergy',
    tableName: 'allergies',
    timestamps: false,
    indexes: [{ name: 'idx_patient_id', fields: ['patient_id'] }],
  }
);

export default Allergy;
