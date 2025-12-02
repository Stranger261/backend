import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class TriageAssessment extends Model {
  getVitalSigns() {
    return typeof this.vital_signs === 'string'
      ? JSON.parse(this.vital_signs)
      : this.vital_signs;
  }

  static async performTriage(erVisitId, assessedBy, vitalSigns, triageData) {
    return await this.create({
      er_visit_id: erVisitId,
      assessed_by: assessedBy,
      vital_signs: JSON.stringify(vitalSigns),
      pain_scale: triageData.painScale,
      consciousness_level: triageData.consciousnessLevel,
      presenting_symptoms: triageData.symptoms,
      triage_category: triageData.category,
      triage_color: triageData.color,
    });
  }
}

TriageAssessment.init(
  {
    triage_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    er_visit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assessment_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    assessed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    vital_signs: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    pain_scale: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    consciousness_level: {
      type: DataTypes.ENUM('alert', 'verbal', 'pain', 'unresponsive'),
      allowNull: false,
    },
    presenting_symptoms: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    triage_category: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    triage_color: {
      type: DataTypes.ENUM('red', 'orange', 'yellow', 'green', 'blue'),
      allowNull: false,
    },
    immediate_interventions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'TriageAssessment',
    tableName: 'triage_assessment',
    timestamps: false,
  }
);

export default TriageAssessment;
