import {
  Staff,
  Patient,
  AppointmentVitals,
  AppointmentDiagnosis,
  Appointment,
  Person,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class AppointmentConsultationService {
  /**
   * Get complete consultation data (vitals + diagnosis) for an appointment
   */
  async getCompleteConsultation(appointmentId) {
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        include: [
          {
            model: AppointmentVitals,
            as: 'vitals',
            include: [
              {
                model: Staff,
                as: 'recordedBy',
                include: [{ model: Person, as: 'person' }],
              },
            ],
          },
          {
            model: AppointmentDiagnosis,
            as: 'diagnosis',
            include: [
              {
                model: Staff,
                as: 'createdBy',
                include: [{ model: Person, as: 'person' }],
              },
            ],
          },
          {
            model: Patient,
            as: 'patient',
            include: [{ model: Person, as: 'person' }],
          },
          {
            model: Staff,
            as: 'doctor',
            include: [{ model: Person, as: 'person' }],
          },
        ],
      });

      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      return appointment;
    } catch (error) {
      console.error('Get complete consultation failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get consultation data.', 500);
    }
  }

  /**
   * Get consultation summary for patient history
   */
  async getPatientConsultationHistory(patientId, limit = 20) {
    try {
      const consultations = await Appointment.findAll({
        where: {
          patient_id: patientId,
          status: 'completed',
        },
        include: [
          {
            model: AppointmentVitals,
            as: 'vitals',
            attributes: [
              'temperature',
              'blood_pressure_systolic',
              'blood_pressure_diastolic',
              'chief_complaint',
            ],
          },
          {
            model: AppointmentDiagnosis,
            as: 'diagnosis',
            attributes: ['primary_diagnosis', 'disposition', 'treatment_plan'],
          },
          {
            model: Staff,
            as: 'doctor',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name'],
              },
            ],
          },
        ],
        order: [['appointment_date', 'DESC']],
        limit,
      });

      return consultations;
    } catch (error) {
      console.error('Get patient consultation history failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get consultation history.', 500);
    }
  }

  /**
   * Update appointment to in-progress when doctor starts consultation
   */
  async startConsultation(appointmentId, doctorStaffId) {
    try {
      const appointment = await Appointment.findByPk(appointmentId);

      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      if (appointment.doctor_id !== doctorStaffId) {
        throw new AppError('Unauthorized. This is not your appointment.', 403);
      }

      if (appointment.status !== 'checked_in') {
        throw new AppError(
          'Cannot start consultation. Patient must be checked in first.',
          400,
        );
      }

      await appointment.update({
        status: 'in_progress',
        start_time: new Date(),
      });

      return await this.getCompleteConsultation(appointmentId);
    } catch (error) {
      console.error('Start consultation failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to start consultation.', 500);
    }
  }

  /**
   * Complete consultation with all data
   */
  async completeConsultation(appointmentId, consultationData, doctorStaffId) {
    try {
      // This will be called after diagnosis is created
      // Update appointment end time
      const appointment = await Appointment.findByPk(appointmentId);

      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      const endTime = new Date();
      const startTime = new Date(appointment.start_time);
      const durationMinutes = Math.round((endTime - startTime) / 60000);

      await appointment.update({
        end_time: endTime,
        duration_minutes: durationMinutes,
      });

      return await this.getCompleteConsultation(appointmentId);
    } catch (error) {
      console.error('Complete consultation failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to complete consultation.', 500);
    }
  }
}

export default new AppointmentConsultationService();
