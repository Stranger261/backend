import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Patient extends Model {
  static async findByMRN(mrn) {
    return await this.findOne({ where: { mrn } });
  }

  isActive() {
    return this.patient_status === 'active';
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
}

Patient.init(
  {
    patient_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // NEW: Public UUID for frontend
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
      { name: 'idx_patient_uuid', fields: ['patient_uuid'] },
      { name: 'idx_mrn', fields: ['mrn'] },
      { name: 'idx_patient_status', fields: ['patient_status'] },
    ],
  }
);

export default Patient;
