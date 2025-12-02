import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PatientConsent extends Model {
  static async hasConsent(patientId, consentType) {
    const consent = await this.findOne({
      where: { patient_id: patientId, consent_type: consentType },
      order: [['granted_date', 'DESC']],
    });
    return consent && consent.granted && !consent.revoked_date;
  }

  isExpired() {
    return this.expires_date && new Date() > this.expires_date;
  }
}

PatientConsent.init(
  {
    consent_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    consent_type: {
      type: DataTypes.ENUM(
        'treatment',
        'data_sharing',
        'research',
        'telehealth',
        'face_recognition',
        'sms_notifications'
      ),
      allowNull: false,
    },
    granted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    granted_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expires_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    revoked_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    signed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    digital_signature: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PatientConsent',
    tableName: 'patient_consents',
    timestamps: false,
    indexes: [
      { name: 'idx_patient_type', fields: ['patient_id', 'consent_type'] },
    ],
  }
);

export default PatientConsent;
