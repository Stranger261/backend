import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';
import IdSequence from '../ibms/IdSequence.model.js';
import AppError from '../../utils/AppError.util.js';

class Patient extends Model {
  static async findByMRN(mrn) {
    return await this.findOne({ where: { mrn } });
  }

  static async findByUUID(patient_uuid) {
    return await this.findOne({ where: { patient_uuid } });
  }

  isActive() {
    return this.patient_status === 'active';
  }

  hasInsurance() {
    return !!this.insurance_provider && !!this.insurance_number;
  }

  isInsuranceValid() {
    if (!this.insurance_expiry) return false;
    return new Date(this.insurance_expiry) > new Date();
  }

  static async createPatient({
    person_id,
    mrn = null,
    primary_doctor_id = null,
    registration_type = 'walk_in',
    first_visit_date = null,
    transaction,
  }) {
    // Validate required fields
    if (!person_id) {
      throw new AppError('person_id is required', 400);
    }

    // Check if patient exists
    const existing = await Patient.findOne({
      where: { person_id },
      transaction,
    });

    if (existing) return existing;

    // Auto-generate MRN if not provided
    if (!mrn) {
      mrn = await IdSequence.getNextValue('mrn');
    }

    // Create the patient
    const patient = await Patient.create(
      {
        mrn,
        person_id,
        patient_status: 'active',
        first_visit_date,
        primary_doctor_id,
        registration_type,
      },
      { transaction }
    );

    return patient;
  }

  // Update medical information
  async updateMedicalInfo({
    height,
    weight,
    chronic_conditions,
    current_medications,
    blood_type,
    medical_notes,
    transaction,
  }) {
    const updates = {};

    if (height !== undefined) updates.height = height;
    if (weight !== undefined) updates.weight = weight;
    if (chronic_conditions !== undefined)
      updates.chronic_conditions = chronic_conditions;
    if (current_medications !== undefined)
      updates.current_medications = current_medications;
    if (blood_type !== undefined) updates.blood_type = blood_type;
    if (medical_notes !== undefined) updates.medical_notes = medical_notes;

    await this.update(updates, { transaction });
    return this;
  }

  // Update insurance information
  async updateInsurance({
    insurance_provider,
    insurance_number,
    insurance_expiry,
    transaction,
  }) {
    const updates = {};

    if (insurance_provider !== undefined)
      updates.insurance_provider = insurance_provider;
    if (insurance_number !== undefined)
      updates.insurance_number = insurance_number;
    if (insurance_expiry !== undefined)
      updates.insurance_expiry = insurance_expiry;

    await this.update(updates, { transaction });
    return this;
  }
}

Patient.init(
  {
    patient_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    patient_uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
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
      allowNull: true,
    },

    primary_doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    registration_type: {
      type: DataTypes.ENUM('online', 'walk_in', 'emergency', 'referral'),
      allowNull: false,
    },

    // Medical Information
    blood_type: {
      type: DataTypes.ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
      allowNull: true,
      comment: 'Patient blood type',
    },

    height: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Height in centimeters',
      validate: {
        min: 0,
        max: 300,
      },
    },

    weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Weight in kilograms',
      validate: {
        min: 0,
        max: 500,
      },
    },

    chronic_conditions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Chronic medical conditions',
    },

    current_medications: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Current medications',
    },

    medical_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional medical notes',
    },

    // Insurance Information
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

    // Additional Fields (Optional but recommended)
    last_checkup_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date of last medical checkup',
    },

    preferred_hospital: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Preferred hospital for referrals',
    },

    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
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
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_patient_uuid', fields: ['patient_uuid'] },
      { name: 'idx_mrn', fields: ['mrn'] },
      { name: 'idx_patient_status', fields: ['patient_status'] },
      { name: 'idx_primary_doctor', fields: ['primary_doctor_id'] },
      { name: 'idx_blood_type', fields: ['blood_type'] },
    ],
  }
);

export default Patient;
