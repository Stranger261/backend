import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Allergy extends Model {
  static async getPatientAllergies(patientId, options = {}) {
    return await this.findAll({
      where: { patient_id: patientId },
      order: [
        ['severity', 'DESC'],
        ['reported_date', 'DESC'],
      ],
      ...options,
    });
  }

  static async addAllergy(patientId, allergyData, reportedBy) {
    return await this.create({
      patient_id: patientId,
      allergen: allergyData.allergen,
      allergy_type: allergyData.allergy_type,
      severity: allergyData.severity,
      reaction: allergyData.reaction || null,
      reported_date: allergyData.reported_date || new Date(),
      reported_by: reportedBy,
      verified: false,
    });
  }

  static async updateAllergy(allergyId, updates) {
    const allergy = await this.findByPk(allergyId);
    if (!allergy) {
      throw new Error('Allergy not found');
    }
    return await allergy.update(updates);
  }

  static async deleteAllergy(allergyId) {
    const allergy = await this.findByPk(allergyId);
    if (!allergy) {
      throw new Error('Allergy not found');
    }
    return await allergy.destroy();
  }

  static async verifyAllergy(allergyId, verifiedBy) {
    return await this.update(
      { verified: true, verified_by: verifiedBy },
      { where: { allergy_id: allergyId } }
    );
  }

  isCritical() {
    return this.severity === 'life_threatening' || this.severity === 'severe';
  }

  static getCriticalAllergies(patientId) {
    return this.findAll({
      where: {
        patient_id: patientId,
        severity: ['severe', 'life_threatening'],
      },
    });
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
      defaultValue: DataTypes.NOW,
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
    indexes: [
      { name: 'idx_patient_id', fields: ['patient_id'] },
      { name: 'idx_severity', fields: ['severity'] },
      { name: 'idx_allergy_type', fields: ['allergy_type'] },
    ],
  }
);

export default Allergy;
