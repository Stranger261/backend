import {
  Staff,
  Person,
  Patient,
  Appointment,
  AppointmentVitals,
  sequelize,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';
import { emitToRoom } from '../../../shared/utils/socketEmitter.js';

class AppointmentVitalsService {
  async createVitals(vitalsData, nurseStaffId) {
    const transaction = await sequelize.transaction();
    try {
      const { appointmentId, patientId, ...vitals } = vitalsData;

      // Verify appointment exists and is in correct status
      const appointment = await Appointment.findOne({
        where: { appointment_id: appointmentId },
        include: [
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
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      if (!['arrived', 'checked_in'].includes(appointment.status)) {
        throw new AppError(
          'Cannot record vitals. Appointment status must be "arrived" or "checked_in".',
          400,
        );
      }

      // Check if vitals already recorded
      const existingVitals = await AppointmentVitals.findOne({
        where: { appointment_id: appointmentId },
        transaction,
      });

      if (existingVitals) {
        throw new AppError(
          'Vitals already recorded for this appointment. Use update instead.',
          409,
        );
      }

      // Create vitals record
      await AppointmentVitals.create(
        {
          appointment_id: appointmentId,
          patient_id: patientId,
          recorded_by: nurseStaffId,
          ...vitals,
        },
        { transaction },
      );

      // Update appointment status to checked_in
      await appointment.update({ status: 'checked_in' }, { transaction });

      // Update patient's latest height and weight
      if (vitals.height || vitals.weight) {
        await Patient.update(
          {
            height: vitals.height || undefined,
            weight: vitals.weight || undefined,
          },
          { where: { patient_id: patientId }, transaction },
        );
      }

      await transaction.commit();

      const doctor = appointment.doctor;
      const patient = appointment.patient;

      const roomName = `doctor-${doctor.staff_uuid}-${doctor.person.last_name}`;

      await emitToRoom(roomName, `patient-status_changed`, {
        appointmentId: appointment.appointment_id,
        patientName: `${patient.person.first_name} ${patient.person.last_name}`,
        doctorId: appointment.doctor_id,
        arrivalTime: new Date(),
        status: appointment.status,
      });

      return await this.getVitalsByAppointment(appointmentId);
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Create vitals failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to create vitals.', 500);
    }
  }

  async updateVitals(appointmentId, vitalsData) {
    try {
      const transaction = await sequelize.transaction();
      const vitals = await AppointmentVitals.findOne({
        where: { appointment_id: appointmentId },
        transaction,
      });

      if (!vitals) {
        throw new AppError('Vitals record not found.', 404);
      }

      await vitals.update(vitalsData, { transaction });

      return await this.getVitalsByAppointment(appointmentId);
    } catch (error) {
      if (!transaction.finish) {
        await transaction.rollback();
      }
      console.error('Update vitals failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to update vitals.', 500);
    }
  }

  async getVitalsByAppointment(appointmentId) {
    try {
      const vitals = await AppointmentVitals.findOne({
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
            model: Patient,
            as: 'patient',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: [
                  'first_name',
                  'last_name',
                  'date_of_birth',
                  'gender',
                ],
              },
            ],
          },
          {
            model: Staff,
            as: 'recordedBy',
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

      if (!vitals) {
        throw new AppError('Vitals record not found.', 404);
      }

      return vitals;
    } catch (error) {
      console.error('Get vitals failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get vitals.', 500);
    }
  }

  async getVitalsByPatient(patientId, limit = 10) {
    try {
      const vitals = await AppointmentVitals.findAll({
        where: { patient_id: patientId },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            attributes: ['appointment_date', 'appointment_time'],
          },
        ],
        order: [['recorded_at', 'DESC']],
        limit,
      });

      return vitals;
    } catch (error) {
      console.error('Get patient vitals history failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get vitals history.', 500);
    }
  }
}

export default new AppointmentVitalsService();
