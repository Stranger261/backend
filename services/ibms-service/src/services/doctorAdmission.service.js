// doctorAdmission.service.js
import AppError from '../../../shared/utils/AppError.util.js';
import {
  Admission,
  AdmissionProgressNote,
  sequelize,
} from '../../../shared/models/index.js';
import progressNoteService from './progressNote.service.js';
import axios from 'axios';

class DoctorAdmissionService {
  // Get doctor's admissions
  async getDoctorAdmissions(doctorId, filters = {}) {
    try {
      const result = await Admission.getDoctorAdmissions({
        doctor_id: doctorId,
        ...filters,
      });
      return result;
    } catch (error) {
      console.error('Get doctor admissions failed:', error.message);
      throw new AppError('Failed to get doctor admissions.', 500);
    }
  }

  // Get detailed view of a specific admission
  async getAdmissionDetails(admissionId, doctorId) {
    try {
      const admission = await Admission.getDoctorAdmissionDetails(
        admissionId,
        doctorId,
      );
      return admission;
    } catch (error) {
      console.error('Get admission details failed:', error.message);
      throw new AppError('Failed to get admission details.', 500);
    }
  }

  // Create a doctor's progress note (doctor round)
  async createDoctorRoundNote(admissionId, doctorId, noteData) {
    try {
      // Use your existing progressNoteService
      const note = await progressNoteService.createProgressNote(
        {
          admissionId,
          patientId: noteData.patientId,
          noteType: 'doctor_round',
          subjective: noteData.subjective,
          objective: noteData.objective,
          assessment: noteData.assessment,
          plan: noteData.plan,
          vitals: noteData.vitals,
          specialInstructions: noteData.specialInstructions,
          isCritical: noteData.isCritical,
        },
        doctorId,
      );

      return note;
    } catch (error) {
      console.error('Create doctor round note failed:', error.message);
      throw new AppError('Failed to create doctor round note.', 500);
    }
  }

  // Update diagnosis or treatment plan
  async updateAdmissionDiagnosis(admissionId, doctorId, updates) {
    const transaction = await sequelize.transaction();

    try {
      const admission = await Admission.findOne({
        where: {
          admission_id: admissionId,
          attending_doctor_id: doctorId,
        },
        transaction,
      });

      if (!admission) {
        throw new AppError('Admission not found or access denied.', 404);
      }

      if (admission.admission_status !== 'active') {
        throw new AppError('Cannot update discharged admission.', 400);
      }

      // Update admission fields
      const allowedUpdates = {};
      if (updates.diagnosis)
        allowedUpdates.diagnosis_at_admission = updates.diagnosis;
      if (updates.expected_discharge_date)
        allowedUpdates.expected_discharge_date =
          updates.expected_discharge_date;

      await admission.update(allowedUpdates, { transaction });

      // Create a progress note for the update
      if (updates.notes || updates.diagnosis) {
        await progressNoteService.createProgressNote(
          {
            admissionId,
            patientId: admission.patient_id,
            noteType: 'diagnosis_update',
            subjective: updates.notes || 'Diagnosis/treatment plan updated',
            assessment: updates.diagnosis || admission.diagnosis_at_admission,
            plan: updates.treatment_plan || 'Continue current treatment',
          },
          doctorId,
        );
      }

      await transaction.commit();
      return admission;
    } catch (error) {
      await transaction.rollback();
      console.error('Update admission diagnosis failed:', error.message);
      throw new AppError('Failed to update admission diagnosis.', 500);
    }
  }

  // Get patients for doctor's rounds (patients not visited today)
  async getPatientsForRounds(doctorId, floor = null) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const where = {
        attending_doctor_id: doctorId,
        admission_status: 'active',
      };

      // Get all doctor's active admissions
      const admissions = await Admission.findAll({
        where,
        include: [
          {
            model: Patient,
            as: 'patient',
            attributes: ['patient_id', 'mrn', 'person_id'],
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name'],
              },
            ],
          },
          {
            model: BedAssignment,
            as: 'bedAssignments',
            where: { is_current: true },
            required: true,
            include: [
              {
                model: Bed,
                as: 'bed',
                attributes: ['bed_number'],
                include: [
                  {
                    model: Room,
                    as: 'room',
                    attributes: ['room_number', 'floor_number'],
                  },
                ],
              },
            ],
          },
          {
            model: AdmissionProgressNote,
            as: 'progressNotes',
            required: false,
            where: {
              note_type: 'doctor_round',
              note_date: {
                [Op.gte]: today,
              },
            },
            attributes: ['note_id', 'note_date'],
          },
        ],
        order: [
          ['expected_discharge_date', 'ASC'], // Prioritize pending discharges
          ['admission_date', 'DESC'],
        ],
      });

      // Filter by floor if specified and format response
      const formatted = admissions
        .filter(admission => {
          const bed = admission.bedAssignments[0];
          if (!bed) return false;

          // Floor filter
          if (floor && bed.bed.room.floor_number !== parseInt(floor)) {
            return false;
          }

          return true;
        })
        .map(admission => {
          const data = admission.toJSON();
          const bed = data.bedAssignments[0];

          // Check if doctor has visited today
          const visitedToday =
            data.progressNotes && data.progressNotes.length > 0;

          return {
            admission_id: data.admission_id,
            patient: {
              patient_id: data.patient.patient_id,
              name: `${data.patient.person.first_name} ${data.patient.person.last_name}`,
              mrn: data.patient.mrn,
              age: this.calculateAge(data.patient.person.date_of_birth),
            },
            location: {
              bed: bed?.bed?.bed_number,
              room: bed?.bed?.room?.room_number,
              floor: bed?.bed?.room?.floor_number,
              room_type: bed?.bed?.room?.room_type,
            },
            diagnosis: data.diagnosis_at_admission,
            admission_date: data.admission_date,
            expected_discharge_date: data.expected_discharge_date,
            length_of_stay: admission.getLengthOfStay(),
            visited_today: visitedToday,
            priority: this.calculatePriority(data),
          };
        });

      return formatted;
    } catch (error) {
      console.error('Get patients for rounds failed:', error.message);
      throw new AppError('Failed to get patients for rounds.', 500);
    }
  }

  // Get doctor's admission statistics
  async getAdmissionStats(doctorId, period = 'month') {
    try {
      const stats = await Admission.getDoctorAdmissionStats(doctorId, period);
      return stats;
    } catch (error) {
      console.error('Get admission stats failed:', error.message);
      throw new AppError('Failed to get admission statistics.', 500);
    }
  }

  // must be fixed. cant be found for admission
  // Request discharge for a patient
  async requestDischarge(admissionId, doctorId, dischargeData) {
    const transaction = await sequelize.transaction();

    try {
      const admission = await Admission.findOne({
        where: {
          admission_id: admissionId,
          attending_doctor_id: doctorId,
        },
        transaction,
      });

      if (!admission) {
        throw new AppError('Admission not found or access denied.', 404);
      }

      if (admission.admission_status !== 'active') {
        throw new AppError('Patient is not currently admitted.', 400);
      }

      // Create progress note for discharge request - PASS THE TRANSACTION
      await progressNoteService.createProgressNote(
        {
          admissionId,
          patientId: admission.patient_id,
          noteType: 'discharge_request',
          subjective: 'Patient ready for discharge',
          assessment: dischargeData.summary,
          plan: `Discharge requested. Follow-up: ${dischargeData.follow_up_instructions || 'As needed'}`,
          specialInstructions: dischargeData.follow_up_instructions,
        },
        doctorId,
        transaction,
      );

      // Update admission to pending discharge
      await admission.update(
        {
          admission_status: 'pending_discharge',
          expected_discharge_date:
            dischargeData.expected_discharge_date || new Date(),
          discharge_summary: dischargeData.summary,
        },
        { transaction },
      );

      await transaction.commit();

      try {
        // Make sure axios is imported at the top of your file

        const externalDischargeData = {
          patient_id: admission.patient_id,
          admission_id: admissionId,
          discharge_datetime:
            dischargeData.expected_discharge_date || new Date().toISOString(),
          final_diagnosis: dischargeData.summary || '',
          discharge_type: dischargeData.discharge_type || 'routine', // You may need to add this to dischargeData
          condition_on_discharge:
            dischargeData.condition_on_discharge || 'stable', // You may need to add this to dischargeData
          follow_up_instructions: dischargeData.follow_up_instructions || '',
        };

        await axios.post(
          'https://core3.health-ease-hospital.com/api/patient_discharge.php',
          externalDischargeData,
          {
            headers: {
              'x-internal-api-key':
                'core-prod-49007c2fad9ac0cabfa6b76d48b7022a',
              'Content-Type': 'application/json',
            },
          },
        );

        console.log('Discharge data sent to external API successfully');
      } catch (apiError) {
        console.error(
          'Failed to send discharge data to external API:',
          apiError.message,
        );

        console.log('api error', apiError?.response?.data?.message);
      }

      return {
        admission,
        message:
          'Discharge request submitted. Awaiting nursing/admin approval.',
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Request discharge failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to request discharge.', 500);
    }
  }

  // Helper methods
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    const ageDiff = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  calculatePriority(admissionData) {
    let priority = 0;

    // Higher priority for pending discharge
    if (
      admissionData.expected_discharge_date &&
      new Date(admissionData.expected_discharge_date) <=
        new Date(Date.now() + 24 * 60 * 60 * 1000)
    ) {
      priority += 3;
    }

    // Higher priority for longer stays
    const los = admissionData.length_of_stay || 0;
    if (los > 7) priority += 1;
    if (los > 14) priority += 1;

    // Lower priority if visited today
    if (admissionData.visited_today) priority = 0;

    return priority;
  }

  // Get admission progress notes with doctor's notes highlighted
  async getAdmissionProgressNotes(admissionId, doctorId) {
    try {
      // First verify doctor has access to this admission
      const admission = await Admission.findOne({
        where: {
          admission_id: admissionId,
          attending_doctor_id: doctorId,
        },
      });

      if (!admission) {
        throw new AppError('Admission not found or access denied.', 404);
      }

      // Get all progress notes
      const result = await progressNoteService.getAdmissionProgressNotes(
        admissionId,
        {
          limit: 100,
          includeDeleted: false,
        },
      );

      // Group notes by day and highlight doctor's notes
      const notesByDay = result.notes.reduce((groups, note) => {
        const date = new Date(note.note_date).toDateString();
        if (!groups[date]) {
          groups[date] = [];
        }

        // Mark if it's a doctor's note
        note.is_doctors_note = note.recorded_by === doctorId;

        groups[date].push(note);
        return groups;
      }, {});

      return {
        notes: result.notes,
        groupedByDay: notesByDay,
        pagination: result.pagination,
      };
    } catch (error) {
      console.error('Get admission progress notes failed:', error.message);
      throw new AppError('Failed to get progress notes.', 500);
    }
  }
}

export default new DoctorAdmissionService();
