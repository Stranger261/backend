import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PatientConsent extends Model {
  /**
   * Check if patient has active consent of a specific type
   */
  static async hasActiveConsent(patientId, consentType) {
    const consent = await this.findOne({
      where: {
        patient_id: patientId,
        consent_type: consentType,
        is_active: true,
        consent_status: 'granted',
      },
    });

    if (!consent) return false;

    // Check if expired based on expires_date
    if (consent.expires_date && new Date(consent.expires_date) < new Date()) {
      await consent.update({
        is_active: false,
        consent_status: 'expired',
      });
      return false;
    }

    return true;
  }

  /**
   * Grant consent
   */
  static async grantConsent(patientId, consentType, options = {}) {
    const {
      expiresDate = null,
      createdBy = null,
      documentPath = null,
    } = options;

    return await this.create({
      patient_id: patientId,
      consent_type: consentType,
      consent_status: 'granted',
      is_active: true,
      granted: true,
      granted_date: new Date(),
      expires_date: expiresDate,
      consent_document_path: documentPath,
      created_by: createdBy,
    });
  }

  /**
   * Revoke consent
   */
  static async revokeConsent(patientId, consentType, reason, revokedBy = null) {
    const [affectedRows] = await this.update(
      {
        is_active: false,
        consent_status: 'revoked',
        granted: false,
        revoked_date: new Date(),
        revoked_reason: reason,
      },
      {
        where: {
          patient_id: patientId,
          consent_type: consentType,
          is_active: true,
        },
      },
    );

    return affectedRows > 0;
  }

  /**
   * Get all active consents for a patient
   */
  static async getActiveConsents(patientId) {
    return await this.findAll({
      where: {
        patient_id: patientId,
        is_active: true,
        consent_status: 'granted',
      },
      order: [['granted_date', 'DESC']],
    });
  }

  /**
   * Get consents expiring soon
   */
  static async getExpiringSoon(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await this.findAll({
      where: {
        is_active: true,
        consent_status: 'granted',
        expires_date: {
          [Op.between]: [new Date(), futureDate],
        },
      },
      order: [['expires_date', 'ASC']],
    });
  }

  /**
   * Get consent history for a patient
   */
  static async getConsentHistory(patientId, consentType = null) {
    const where = { patient_id: patientId };
    if (consentType) where.consent_type = consentType;

    return await this.findAll({
      where,
      order: [['granted_date', 'DESC']],
    });
  }

  /**
   * Renew expiring consent
   */
  static async renewConsent(consentId, newExpiryDate, renewedBy) {
    const consent = await this.findByPk(consentId);
    if (!consent) return null;

    return await consent.update({
      expires_date: newExpiryDate,
      is_active: true,
      consent_status: 'granted',
      created_by: renewedBy,
    });
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
        'sms_notifications',
      ),
      allowNull: false,
    },
    consent_status: {
      type: DataTypes.ENUM('granted', 'revoked', 'expired'),
      allowNull: false,
      defaultValue: 'granted',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    granted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    granted_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    revoked_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoked_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    consent_document_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PatientConsent',
    tableName: 'patient_consents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_consent_patient', fields: ['patient_id'] },
      { name: 'idx_consent_type', fields: ['consent_type'] },
      { name: 'idx_consent_active', fields: ['is_active'] },
      { name: 'idx_consent_status', fields: ['consent_status'] },
      {
        name: 'idx_consent_patient_type_active',
        fields: ['patient_id', 'consent_type', 'is_active'],
      },
    ],
  },
);

export default PatientConsent;
