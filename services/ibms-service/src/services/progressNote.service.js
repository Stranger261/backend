import {
  Admission,
  AdmissionProgressNote,
  Patient,
  Person,
  sequelize,
  Staff,
  MedicalRecord,
} from '../../../shared/models/index.js';
import { Op } from 'sequelize';
import AppError from '../../../shared/utils/AppError.util.js';

class progressNoteService {
  // must be fixed. cant be found for admission
  async createProgressNote(noteData, staffId, externalTransaction = null) {
    const transaction = externalTransaction || (await sequelize.transaction());

    try {
      const {
        admissionId,
        patientId,
        noteType,
        subjective,
        objective,
        assessment,
        plan,
        vitals,
        intakeOutput,
        woundCare,
        specialInstructions,
        isCritical,
      } = noteData;

      const admission = await Admission.findOne({
        where: { admission_id: admissionId, admission_status: 'active' },
        include: [
          {
            model: Patient,
            as: 'patient',
            include: [{ model: Person, as: 'person' }],
          },
        ],
        transaction,
      });

      if (!admission) {
        throw new AppError(
          'Active admission not found or patient has been discharged.',
          404,
        );
      }

      if (admission.patient_id !== patientId) {
        throw new AppError('Patient does not match the admission.', 400);
      }

      const progressNote = await AdmissionProgressNote.create(
        {
          admission_id: admissionId,
          patient_id: patientId,
          note_type: noteType,
          note_date: new Date(),
          recorded_by: staffId,
          subjective,
          objective,
          assessment,
          plan,
          temperature: vitals?.temperature || null,
          blood_pressure_systolic: vitals?.blood_pressure_systolic || null,
          blood_pressure_diastolic: vitals?.blood_pressure_diastolic || null,
          heart_rate: vitals?.heart_rate || null,
          respiratory_rate: vitals?.respiratory_rate || null,
          oxygen_saturation: vitals?.oxygen_saturation || null,
          pain_level: vitals?.pain_level || null,
          consciousness_level: vitals?.consciousness_level || null,
          intake_output: intakeOutput || null,
          wound_care: woundCare || null,
          special_instructions: specialInstructions || null,
          is_critical: isCritical || false,
        },
        { transaction },
      );

      const completeNote = await this.getProgressNoteById(
        progressNote.note_id,
        transaction,
      );

      if (noteType === 'doctor_round' && assessment) {
        await MedicalRecord.create(
          {
            patient_id: patientId,
            visit_type: 'admission',
            visit_id: admissionId,
            record_type: 'consultation',
            record_date: new Date(),
            doctor_id: staffId,
            diagnosis: assessment,
            treatment: plan,
            notes: `Doctor Round - ${subjective || 'Progress note'}`,
          },
          { transaction },
        );
      }

      // Only commit if this method created the transaction
      if (!externalTransaction) {
        await transaction.commit();
      }

      // Return the created note with includes
      return completeNote;
    } catch (error) {
      // Only rollback if this method created the transaction
      if (!externalTransaction) {
        await transaction.rollback();
      }
      console.error('Create progress note failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to create progress note.', 500);
    }
  }

  async amendProgressNote(originalNoteId, amendmentData, staffId) {
    const transaction = await sequelize.transaction();
    try {
      const { reason, ...newNoteData } = amendmentData;

      const originalNote = await AdmissionProgressNote.findByPk(
        originalNoteId,
        {
          transaction,
        },
      );

      if (!originalNote) {
        throw new AppError('Original progress note not found.', 404);
      }

      if (originalNote.is_deleted) {
        throw new AppError('Cannot amend a deleted note.', 400);
      }

      await originalNote.update(
        {
          is_amended: true,
          amended_at: new Date(),
          amended_by: staffId,
          amendment_reason: reason,
        },
        { transaction },
      );

      // Create new note as amendment
      const amendedNote = await AdmissionProgressNote.create(
        {
          admission_id: originalNote.admission_id,
          patient_id: originalNote.patient_id,
          note_type: originalNote.note_type,
          note_date: new Date(),
          recorded_by: staffId,
          original_note_id: originalNoteId,
          temperature: newNoteData.vitals.temperature,
          blood_pressure_systolic: newNoteData.vitals.blood_pressure_systolic,
          blood_pressure_diastolic: newNoteData.vitals.blood_pressure_diastolic,
          heart_rate: newNoteData.vitals.heart_rate,
          respiratory_rate: newNoteData.vitals.respiratory_rate,
          oxygen_saturation: newNoteData.vitals.oxygen_saturation,
          pain_level: newNoteData.vitals.pain_level,
          consciousness_level: newNoteData.vitals.consciousness_level,
          intake_output: newNoteData.intakeOutput,
          wound_care: newNoteData.woundCare,
          special_instructions: newNoteData.specialInstructions,
          is_critical: newNoteData.isCritical,
          is_amended: true,
          amended_at: new Date(),
          amended_by: staffId,
          ...newNoteData,
        },
        { transaction },
      );

      await transaction.commit();

      return await this.getProgressNoteById(amendedNote.note_id);
    } catch (error) {
      await transaction.rollback();
      console.error('Amend progress note failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to amend progress note.', 500);
    }
  }

  async deleteProgressNote(noteId, staffId, reason) {
    const transaction = await sequelize.transaction();
    try {
      const note = await AdmissionProgressNote.findByPk(noteId, {
        transaction,
      });

      if (!note) {
        throw new AppError('Progress note not found.', 404);
      }

      if (note.is_deleted) {
        throw new AppError('Progress note is already deleted.', 400);
      }

      await note.update(
        {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: staffId,
          special_instructions: reason
            ? `${note.special_instructions || ''}\n\nDELETION REASON: ${reason}`
            : note.special_instructions,
        },
        { transaction },
      );

      await transaction.commit();

      return { message: 'Progress note deleted successfully.' };
    } catch (error) {
      await transaction.rollback();
      console.error('Delete progress note failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to delete progress note.', 500);
    }
  }

  async getProgressNoteById(noteId, transaction = null) {
    const options = {
      include: [
        {
          model: Staff,
          as: 'recorder',
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
        {
          model: Admission,
          as: 'admission',
          attributes: ['admission_id', 'admission_number', 'admission_status'],
        },
      ],
    };

    // Add transaction if provided
    if (transaction) {
      options.transaction = transaction;
    }

    const note = await AdmissionProgressNote.findByPk(noteId, options);

    if (!note) {
      throw new AppError('Progress note not found.', 404);
    }

    return note;
  }

  async getAdmissionProgressNotes(admissionId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        noteType = null,
        startDate = null,
        endDate = null,
        isCritical = null,
        includeDeleted = false,
      } = filters;

      const offset = (page - 1) * limit;
      const where = { admission_id: admissionId };

      if (!includeDeleted) {
        where.is_deleted = false;
      }

      if (noteType) {
        where.note_type = noteType;
      }

      if (isCritical) {
        where.is_critical = isCritical;
      }

      if (startDate || endDate) {
        where.note_date = {};
        if (startDate) {
          where.note_date[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          where.note_date[Op.lte] = new Date(endDate);
        }
      }

      const { rows: notes, count: total } =
        await AdmissionProgressNote.findAndCountAll({
          where,
          include: [
            {
              model: Staff,
              as: 'recorder',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'suffix',
                  ],
                },
              ],
            },
            {
              model: Staff,
              as: 'amender',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'suffix',
                  ],
                },
              ],
            },
            {
              model: AdmissionProgressNote,
              as: 'amendments',
              required: false,
              attributes: ['note_id', 'note_date', 'recorded_by'],
            },
          ],
          order: [['note_date', 'DESC']],
          limit: parseInt(limit),
          offset,
          distinct: true,
        });

      return {
        notes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Get admission progress notes failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get admission progress notes.', 500);
    }
  }

  async getVitalSignHistory(admissionId, limit = 20) {
    try {
      const vitals = await AdmissionProgressNote.findAll({
        where: { admission_id: admissionId },
        [Op.or]: [
          { temperature: { [Op.ne]: null } },
          { blood_pressure_systolic: { [Op.ne]: null } },
          { heart_rate: { [Op.ne]: null } },
        ],
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
          'recorded_by',
        ],
        include: [
          {
            model: Staff,
            as: 'recorder',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name'],
              },
            ],
          },
        ],
        order: [['note_date', 'DESC']],
        limit: parseInt(limit),
      });

      return vitals;
    } catch (error) {
      console.error('Get vital signs history failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get vital signs history.', 500);
    }
  }

  async getLatestProgressNote(admissionId) {
    try {
      const notes = await AdmissionProgressNote.findOne({
        where: { admission_id: admissionId },
        include: [
          {
            model: Staff,
            as: 'recorder',
            include: [{ model: Person, as: 'person' }],
          },
        ],
        order: [['note_date', 'DESC']],
      });

      return note;
    } catch (error) {
      console.error('Get latest progress note failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get latest progress note.', 500);
    }
  }

  async getProgressNoteWithHistory(noteId) {
    try {
      const note = await AdmissionProgressNote.getWithHistory(noteId);

      if (!note) {
        throw new AppError('Progress note not found.', 404);
      }

      return note;
    } catch (error) {
      console.error('Get progress note with history failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get progress note with history.', 500);
    }
  }

  async getVitalsTrendWithComparison(admissionId, limit = 20) {
    try {
      const vitals = await AdmissionProgressNote.getVitalsTrend(
        admissionId,
        limit,
      );

      // Add comparison with previous reading
      const vitalsWithComparison = vitals.map((vital, index) => {
        const vitalData = vital.toJSON();

        if (index < vitals.length - 1) {
          const previousVital = vitals[index + 1];
          vitalData.comparison = vital.getVitalsComparison(previousVital);
        }

        return vitalData;
      });

      return vitalsWithComparison;
    } catch (error) {
      console.error('Get vitals trend failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get vitals trend.', 500);
    }
  }
}

export default new progressNoteService();
