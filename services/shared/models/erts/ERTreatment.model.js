import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class ERTreatment extends Model {
  static async recordTreatment(erVisitId, performedBy, treatmentData) {
    return await this.create({
      er_visit_id: erVisitId,
      performed_by: performedBy,
      treatment_type: treatmentData.type,
      description: treatmentData.description,
      medication_name: treatmentData.medication,
      dosage: treatmentData.dosage,
      route: treatmentData.route,
      outcome: treatmentData.outcome,
    });
  }
}

ERTreatment.init(
  {
    treatment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    er_visit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    treatment_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    treatment_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    medication_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    dosage: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    route: {
      type: DataTypes.ENUM(
        'oral',
        'IV',
        'IM',
        'subcutaneous',
        'topical',
        'inhalation'
      ),
      allowNull: true,
    },
    outcome: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ERTreatment',
    tableName: 'er_treatments',
    timestamps: false,
  }
);

export default ERTreatment;
