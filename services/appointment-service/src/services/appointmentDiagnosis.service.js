import { Op } from 'sequelize';
import {
  Staff,
  Person,
  Admission,
  Appointment,
  AppointmentDiagnosis,
  sequelize,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class AppointmentDiagnosisService {
  async createDiagnosis(diagnosisData, doctorStaffId) {
    const transaction = await sequelize.transaction();

    try {
      const { appointmentId, ...diagnosis } = diagnosisData;

      // Verify appointment exists and is in progress
      const appointment = await Appointment.findByPk(appointmentId, {
        transaction,
      });
      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      if (!['checked_in', 'in_progress'].includes(appointment.status)) {
        throw new AppError(
          'Cannot create diagnosis. Appointment must be checked in first.',
          400,
        );
      }

      // Check if diagnosis already exists
      const existingDiagnosis = await AppointmentDiagnosis.findOne({
        where: { appointment_id: appointmentId },
        transaction,
      });

      if (existingDiagnosis) {
        throw new AppError(
          'Diagnosis already exists for this appointment. Use update instead.',
          409,
        );
      }

      // Create diagnosis
      const newDiagnosis = await AppointmentDiagnosis.create(
        {
          appointment_id: appointmentId,
          created_by: doctorStaffId,
          ...diagnosis,
        },
        { transaction },
      );

      // Handle admission if required
      if (diagnosis.requires_admission || diagnosis.disposition === 'admit') {
        await this.createAdmissionFromAppointment(
          appointment,
          newDiagnosis,
          doctorStaffId,
          transaction,
        );
      }

      // Handle follow-up if required
      if (diagnosis.requires_followup && diagnosis.followup_date) {
        await this.scheduleFollowupAppointment(
          appointment,
          diagnosis.followup_date,
          transaction,
        );
      }

      // Update appointment status to completed
      await appointment.update({ status: 'completed' }, { transaction });

      await transaction.commit();

      return await this.getDiagnosisByAppointment(appointmentId);
    } catch (error) {
      await transaction.rollback();
      console.error('Create diagnosis failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to create diagnosis.', 500);
    }
  }

  async updateDiagnosis(appointmentId, diagnosisData) {
    try {
      const diagnosis = await AppointmentDiagnosis.findOne({
        where: { appointment_id: appointmentId },
      });

      if (!diagnosis) {
        throw new AppError('Diagnosis not found.', 404);
      }

      await diagnosis.update(diagnosisData);

      return await this.getDiagnosisByAppointment(appointmentId);
    } catch (error) {
      console.error('Update diagnosis failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to update diagnosis.', 500);
    }
  }

  async getDiagnosisByAppointment(appointmentId) {
    try {
      const diagnosis = await AppointmentDiagnosis.findOne({
        where: { appointment_id: appointmentId },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            attributes: [
              'appointment_id',
              'appointment_date',
              'appointment_time',
              'status',
            ],
          },
          {
            model: Staff,
            as: 'createdBy',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name'],
              },
            ],
          },
        ],
      });

      if (!diagnosis) {
        throw new AppError('Diagnosis not found.', 404);
      }

      return diagnosis;
    } catch (error) {
      console.error('Get diagnosis failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get diagnosis.', 500);
    }
  }

  async createAdmissionFromAppointment(
    appointment,
    diagnosis,
    doctorStaffId,
    transaction,
  ) {
    try {
      // Generate admission number
      const admissionNumber = await this.generateAdmissionNumber();

      const admission = await Admission.create(
        {
          admission_number: admissionNumber,
          patient_id: appointment.patient_id,
          appointment_id: appointment.appointment_id,
          admission_date: new Date(),
          admission_type: 'elective', // or determine based on priority
          admission_source: 'outpatient',
          attending_doctor_id: doctorStaffId,
          diagnosis_at_admission: diagnosis.primary_diagnosis,
          admission_status: 'active',
          expected_discharge_date: diagnosis.estimated_stay_days
            ? new Date(
                Date.now() +
                  diagnosis.estimated_stay_days * 24 * 60 * 60 * 1000,
              )
            : null,
        },
        { transaction },
      );

      return admission;
    } catch (error) {
      console.error('Create admission failed:', error.message);
      throw error;
    }
  }

  async scheduleFollowupAppointment(appointment, followupDate, transaction) {
    try {
      const followupAppointment = await Appointment.create(
        {
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          department_id: appointment.department_id,
          appointment_type: 'followup',
          appointment_date: followupDate,
          appointment_time: appointment.appointment_time, // Same time slot
          status: 'scheduled',
          reason: `Follow-up from appointment on ${appointment.appointment_date}`,
        },
        { transaction },
      );

      return followupAppointment;
    } catch (error) {
      console.error('Schedule follow-up failed:', error.message);
      throw error;
    }
  }

  async generateAdmissionNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastAdmission = await Admission.findOne({
      where: {
        admission_number: {
          [Op.like]: `ADM-${year}${month}%`,
        },
      },
      order: [['admission_id', 'DESC']],
    });

    let sequence = 1;
    if (lastAdmission) {
      const lastNum = parseInt(lastAdmission.admission_number.split('-')[2]);
      sequence = lastNum + 1;
    }

    return `ADM-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }
}

export default new AppointmentDiagnosisService();
