import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AdmissionProgressNote extends Model {
  static async getByAdmission(admissionId, options = {}) {
    const { limit = 50, noteType = null, includeDeleted = false } = options;

    const where = { admission_id: admissionId };

    // By default, exclude soft-deleted notes
    if (!includeDeleted) {
      where.is_deleted = false;
    }

    if (noteType) {
      where.note_type = noteType;
    }

    return await this.findAll({
      where,
      include: [
        {
          model: User,
          as: 'recorder',
          attributes: ['user_id', 'username'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
        {
          model: User,
          as: 'amender',
          required: false,
          attributes: ['user_id', 'username'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
        {
          model: AdmissionProgressNote,
          as: 'originalNote',
          required: false,
        },
        {
          model: AdmissionProgressNote,
          as: 'amendments',
          required: false,
        },
      ],
      order: [['note_date', 'DESC']],
      limit,
    });
  }

  static async getWithHistory(noteId) {
    // Get note with all its amendments
    return await this.findByPk(noteId, {
      include: [
        {
          model: User,
          as: 'recorder',
          include: [{ model: Person, as: 'person' }],
        },
        {
          model: AdmissionProgressNote,
          as: 'originalNote',
          include: [
            {
              model: User,
              as: 'recorder',
              include: [{ model: Person, as: 'person' }],
            },
          ],
        },
        {
          model: AdmissionProgressNote,
          as: 'amendments',
          include: [
            {
              model: User,
              as: 'recorder',
              include: [{ model: Person, as: 'person' }],
            },
            {
              model: User,
              as: 'amender',
              include: [{ model: Person, as: 'person' }],
            },
          ],
          order: [['created_at', 'ASC']],
        },
      ],
    });
  }

  static async getVitalsTrend(admissionId, limit = 20) {
    return await this.findAll({
      where: {
        admission_id: admissionId,
        is_deleted: false,
        [Op.or]: [
          { temperature: { [Op.ne]: null } },
          { blood_pressure_systolic: { [Op.ne]: null } },
          { heart_rate: { [Op.ne]: null } },
        ],
      },
      attributes: [
        'note_id',
        'note_type',
        'note_date',
        'temperature',
        'blood_pressure_systolic',
        'blood_pressure_diastolic',
        'heart_rate',
        'respiratory_rate',
        'oxygen_saturation',
        'pain_level',
        'consciousness_level',
      ],
      order: [['note_date', 'ASC']], // Chronological for trend
      limit: parseInt(limit),
    });
  }

  isDeleted() {
    return this.is_deleted === true;
  }

  isAmended() {
    return this.is_amended === true;
  }

  hasAmendments() {
    return this.amendments && this.amendments.length > 0;
  }

  getVitalsComparison(previousNote) {
    if (!previousNote) return null;

    return {
      temperature: {
        current: this.temperature,
        previous: previousNote.temperature,
        change:
          this.temperature && previousNote.temperature
            ? (this.temperature - previousNote.temperature).toFixed(2)
            : null,
      },
      blood_pressure: {
        current:
          this.blood_pressure_systolic && this.blood_pressure_diastolic
            ? `${this.blood_pressure_systolic}/${this.blood_pressure_diastolic}`
            : null,
        previous:
          previousNote.blood_pressure_systolic &&
          previousNote.blood_pressure_diastolic
            ? `${previousNote.blood_pressure_systolic}/${previousNote.blood_pressure_diastolic}`
            : null,
        change_systolic:
          this.blood_pressure_systolic && previousNote.blood_pressure_systolic
            ? this.blood_pressure_systolic -
              previousNote.blood_pressure_systolic
            : null,
      },
      heart_rate: {
        current: this.heart_rate,
        previous: previousNote.heart_rate,
        change:
          this.heart_rate && previousNote.heart_rate
            ? this.heart_rate - previousNote.heart_rate
            : null,
      },
      oxygen_saturation: {
        current: this.oxygen_saturation,
        previous: previousNote.oxygen_saturation,
        change:
          this.oxygen_saturation && previousNote.oxygen_saturation
            ? this.oxygen_saturation - previousNote.oxygen_saturation
            : null,
      },
    };
  }
}

AdmissionProgressNote.init(
  {
    note_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'admissions',
        key: 'admission_id',
      },
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'patient_id',
      },
    },
    note_type: {
      type: DataTypes.ENUM(
        'doctor_round',
        'nurse_note',
        'vital_signs',
        'medication_admin',
        'procedure',
        'assessment',
        'discharge_request',
      ),
      allowNull: false,
    },
    note_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    recorded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    // SOAP Notes
    subjective: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    objective: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assessment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    plan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Vital Signs
    temperature: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
    },
    blood_pressure_systolic: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    blood_pressure_diastolic: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    heart_rate: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    respiratory_rate: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    respiratory_rate: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    oxygen_saturation: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    },
    pain_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 10,
      },
    },
    // Additional Clinical Data
    consciousness_level: {
      type: DataTypes.ENUM('alert', 'drowsy', 'stupor', 'coma'),
      allowNull: true,
    },
    intake_output: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    wound_care: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    special_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Flags
    is_critical: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Audit Trail - Soft Delete
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    // Audit Trail - Amendments
    is_amended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Was this note corrected/amended',
    },
    amended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    amended_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    amendment_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    original_note_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'If this is an amendment, references the original note',
      references: {
        model: 'admission_progress_notes',
        key: 'note_id',
      },
    },
    // Metadata
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
    modelName: 'AdmissionProgressNote',
    tableName: 'admission_progress_notes',
    timestamps: false,
    indexes: [
      {
        name: 'idx_progress_notes_admission',
        fields: ['admission_id'],
      },
      {
        name: 'idx_progress_notes_patient',
        fields: ['patient_id'],
      },
      {
        name: 'idx_progress_notes_date',
        fields: ['note_date'],
      },
      {
        name: 'idx_progress_notes_type',
        fields: ['note_type'],
      },
      {
        name: 'idx_progress_notes_recorded_by',
        fields: ['recorded_by'],
      },
      {
        name: 'idx_progress_notes_critical',
        fields: ['is_critical'],
      },
      {
        name: 'idx_progress_notes_deleted',
        fields: ['is_deleted'],
      },
      {
        name: 'idx_progress_notes_admission_date',
        fields: ['admission_id', 'note_date'],
      },
    ],
  },
);

export default AdmissionProgressNote;
