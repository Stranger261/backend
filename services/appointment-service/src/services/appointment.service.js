import { Op } from 'sequelize';
import sequelize from '../../../shared/config/db.config.js';
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import dayjs from 'dayjs';

import AppError from '../../../shared/utils/AppError.util.js';
import {
  Appointment,
  AppointmentHistory,
  AppointmentPayment,
  AppointmentPricing,
  Department,
  DoctorLeave,
  IdSequence,
  Patient,
  Person,
  Staff,
  User,
} from '../../../shared/models/index.js';

class AppointmentService {
  constructor() {
    this.addMinutes = (startTime, minutesToAdd) => {
      const currentDate = dayjs().format('YYYY-MM-DD');
      const dateString = `${currentDate} ${startTime}`;

      const endTime = dayjs(dateString).add(minutesToAdd, 'minute');
      return endTime.isValid() ? endTime.format('HH:mm:ss') : 'Invalid Date';
    };
  }
  // Appointment Generator
  static async getNextAppointmentNumber(sequenceType) {
    const transaction = await sequelize.transaction();

    try {
      const currentYear = new Date().getFullYear();

      // Define defaults for each sequence type
      const sequenceDefaults = {
        mrn: { prefix: 'MRN', padding_length: 6 },
        appointment: { prefix: 'APT', padding_length: 6 },
        admission: { prefix: 'ADM', padding_length: 6 },
        er_visit: { prefix: 'ER', padding_length: 6 },
        invoice: { prefix: 'INV', padding_length: 6 },
        prescription: { prefix: 'RX', padding_length: 6 },
        lab_order: { prefix: 'LAB', padding_length: 6 },
      };

      const defaults = sequenceDefaults[sequenceType];

      if (!defaults) {
        throw new Error(`Invalid sequence type: ${sequenceType}`);
      }

      // Find or create the sequence
      const [sequence, created] = await IdSequence.findOrCreate({
        where: { sequence_type: sequenceType },
        defaults: {
          sequence_type: sequenceType,
          prefix: defaults.prefix,
          current_value: 0,
          year: currentYear,
          reset_yearly: true,
          padding_length: defaults.padding_length,
          last_updated: new Date(),
        },
        transaction,
      });

      // Check if need to reset for new year
      if (sequence.reset_yearly && sequence.year < currentYear) {
        sequence.current_value = 1;
        sequence.year = currentYear;
        sequence.last_updated = new Date();
        await sequence.save({ transaction });

        await transaction.commit();

        return this.formatId(
          sequence.prefix,
          currentYear,
          1,
          sequence.padding_length
        );
      }

      // Increment
      sequence.current_value += 1;
      sequence.last_updated = new Date();
      await sequence.save({ transaction });

      await transaction.commit();

      return this.formatId(
        sequence.prefix,
        sequence.year,
        sequence.current_value,
        sequence.padding_length
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static formatId(prefix, year, value, padding) {
    const paddedValue = String(value).padStart(padding, '0');
    return `${prefix}-${year}-${paddedValue}`;
  }

  // Calculate price
  async calculateAppointmentFee(
    doctorId,
    departmentId,
    appointmentType,
    durationMinutes = 30
  ) {
    try {
      const pricing = await AppointmentPricing.getPricing(
        doctorId,
        departmentId,
        appointmentType
      );
      const cost = AppointmentPricing.calculateCost(
        pricing.base_fee,
        pricing.extension_fee_per_30min,
        durationMinutes
      );

      return cost;
    } catch (error) {
      console.error('Calculate fee error:', error);
      throw new AppError(
        error.message || 'Failed to calculate appointment fee',
        400
      );
    }
  }

  // book appointment
  async bookAppointment(appointmentData) {
    const transaction = await sequelize.transaction();

    try {
      const {
        person_id,
        department_id,
        doctor_uuid, // this is staff_id but the role is doctor so lets assume doctor_id for better
        appointment_date,
        start_time,
        end_time = null,
        duration_minutes = 30,
        appointment_type = 'consultation',
        reason,
        priority = 'normal',
        created_by_uuid = null,
        created_by_type,
      } = appointmentData;

      // 1. Validate
      if (
        !person_id ||
        !doctor_uuid ||
        !appointment_date ||
        !start_time ||
        !reason
      ) {
        throw new AppError('Missing required fields', 400);
      }

      const doctor = await Staff.findOne(
        {
          where: {
            staff_uuid: doctor_uuid,
          },
        },
        { transaction }
      );

      if (!doctor || doctor.role !== 'doctor') {
        throw new AppError('Doctor not found', 404);
      }

      let created_by_id = null;
      let creator_type = 'user';
      if (created_by_uuid && created_by_type) {
        if (created_by_type === 'staff') {
          const staff = await Staff.findOne({
            where: { staff_uuid: created_by_uuid },
            attributes: ['staff_id'],
          });
          created_by_id = staff?.staff_id;
          creator_type = 'staff';
        } else {
          const user = await User.findOne({
            where: { user_uuid: created_by_uuid },
            attributes: ['user_id'],
          });
          created_by_id = user?.staff_id;
          creator_type = 'user';
        }
      }

      const person = await Person.findByPk(person_id);

      if (!person) {
        throw new AppError('Person not found', 404);
      }

      const patient = await Patient.createPatient({
        person_id,
        mrn: null, // auto-generate
        primary_doctor_id: doctor.staff_id,
        registration_type: creator_type === 'user' ? 'online' : 'walk_in',
        first_visit_date: null,
        transaction,
      });

      const hasConflict = await Appointment.hasConflict(
        doctor_uuid,
        appointment_date,
        start_time
      );

      if (hasConflict) {
        throw new AppError('This time slot is already booked', 409);
      }

      const pricing = await this.calculateAppointmentFee(
        doctor.staff_id,
        department_id,
        appointment_type,
        duration_minutes
      );

      const appointmentNumber = await IdSequence.getNextValue('appointment');
      const finishTime = end_time ? end_time : this.addMinutes(start_time, 30);

      const appointment = await Appointment.create(
        {
          appointment_number: appointmentNumber,
          patient_id: patient.patient_id,
          doctor_id: doctor.staff_id,
          department_id,
          appointment_type,
          appointment_date,
          appointment_time: start_time,
          start_time,
          end_time: finishTime,
          duration_minutes,
          time_extended_minutes: pricing.extendedMinutes,
          status: 'scheduled',
          reason,
          priority,
          consultation_fee: pricing.baseFee,
          extension_fee: pricing.extensionFee,
          total_amount: pricing.totalAmount,
          payment_status: 'pending',
          created_by: created_by_id,
          created_by_type: creator_type,
        },
        { transaction }
      );

      if (!appointment) {
        throw new AppError('Creating new appointment failed', 400);
      }

      const aptHistory = await AppointmentHistory.create(
        {
          appointment_id: appointment.appointment_id,
          action_type: 'created',
          new_status: 'scheduled',
          new_date: appointment_date,
          new_time: start_time,
          changed_by: created_by_id,
          changed_by_type: creator_type,
          change_reason:
            patient.first_visit_date === null
              ? 'First appointment - Patient record created'
              : 'Appointment created',
        },
        { transaction }
      );

      if (!aptHistory) {
        throw new AppError('Creating new appointment failed', 400);
      }

      await transaction.commit();

      return await this.getAppointmentById(appointment.appointment_id);
    } catch (error) {
      await transaction.rollback();
      console.error('Book appointment error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to book appointment', 500);
    }
  }

  // get appointment using appointment_id
  async getAppointmentById(appointmentId) {
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        include: [
          {
            model: Patient,
            as: 'patient',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: [
                  'first_name',
                  'middle_name',
                  'last_name',
                  'date_of_birth',
                  'gender',
                ],
              },
            ],
          },
          {
            model: Staff,
            as: 'doctor',
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'last_name', 'gender'],
              },
            ],
          },
          { model: Department, as: 'department' },
          {
            model: AppointmentHistory,
            as: 'history',
            limit: 5,
            order: [['created_at', 'DESC']],
          },
          {
            model: AppointmentPayment,
            as: 'payments',
          },
        ],
      });

      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }

      return appointment;
    } catch (error) {
      console.error('Get appointment error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get appointment', 500);
    }
  }

  async getPatientAppointments(patientUuid, filters = {}) {
    try {
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
        include: [
          {
            model: Person,
            as: 'person',
          },
        ],
      });

      if (!patient) {
        throw new AppError('Patient not found.', 404);
      }
      const patientId = patient.patient_id;
      const {
        status,
        from_date,
        to_date,
        appointment_type,
        page = 1,
        limit = 20,
      } = filters;

      const where = { patient_id: patientId };

      if (status) {
        where.status = status;
      }

      if (from_date && to_date) {
        where.appointment_date = { [Op.between]: [from_date, to_date] };
      }

      if (appointment_type) {
        where.appointment_type = appointment_type;
      }

      const offset = (page - 1) * limit;

      const { rows: appointments, count: total } =
        await Appointment.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: [
            ['appointment_date', 'DESC'],
            ['start_time', 'ASC'],
          ],
          include: [
            {
              model: Staff,
              as: 'doctor',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'gender',
                  ],
                },
              ],
            },
            { model: Department, as: 'department' },
          ],
        });

      return {
        appointments,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Get patient appointments error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get patient appointment', 500);
    }
  }

  async getDoctorAppointments(doctorId, filters = {}) {
    try {
      const { status, from_date, to_date, page = 1, limit = 20 } = filters;

      const doctor = await Staff.findOne({ where: { staff_uuid: doctorId } });

      const where = { doctor_id: doctor.staff_id };

      if (status) {
        where.status = status;
      }

      if (from_date && to_date) {
        where.appointment_date = { [Op.between]: [from_date, to_date] };
      }

      const offset = (page - 1) * limit;

      const { rows: appointments, count: total } =
        await Appointment.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: [
            ['appointment_date', 'ASC'],
            ['start_time', 'ASC'],
          ],
          include: [
            {
              model: Patient,
              as: 'patient',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'date_of_birth',
                    'gender',
                    'gender_specification',
                  ],
                  include: [{ model: User, as: 'user', attributes: ['phone'] }],
                },
              ],
            },
            {
              model: Department,
              as: 'department',
            },
          ],
        });

      return {
        appointments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(offset),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Get doctor appointments error:', error);
      throw new AppError('Failed to get doctor appointments', 500);
    }
  }

  async getTodaysAppointments(filters = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log(today);
    try {
      const { doctor_uuid, status, page = 1, limit = 20 } = filters;

      const where = { appointment_date: today };

      if (status) {
        where.status = status;
      }
      if (doctor_uuid) {
        where.staff_uuid = doctor_uuid;
      }

      const offset = (page - 1) * limit;

      const { rows: appointments, count: total } =
        await Appointment.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: [['start_time', 'ASC']],
          include: [
            {
              model: Patient,
              as: 'patient',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'date_of_birth',
                    'gender',
                  ],
                },
                {
                  model: Staff,
                  as: 'doctor',
                  include: [
                    {
                      model: Person,
                      as: 'person',
                      attributes: ['first_name', 'middle_name', 'last_name'],
                    },
                    {
                      model: Department,
                      as: 'department',
                    },
                  ],
                },
              ],
            },
          ],
        });

      return {
        date: today,
        appointments,
        pagination: {
          limit: parseInt(limit),
          page: parseInt(page),
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.log(`Get today's appointments failed: `, error);
      throw error instanceof AppError
        ? error
        : AppError(`Failed to fetch today's appointments.`, 500);
    }
  }

  async checkInAppointment(appointmentId, checkedInBy) {
    const transaction = await sequelize.transaction();

    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }

      if (!appointment.canCheckIn()) {
        throw new AppError(
          'Only scheduled appointments can be checked in',
          400
        );
      }

      const oldStatus = appointment.status;

      await appointment.update(
        {
          status: 'checked-in',
          checked_in_at: new Date(),
        },
        { transaction }
      );

      await AppointmentHistory.create(
        {
          appointment_id: appointment.appointment_id,
          action_type: 'checked-in',
          previous_status: oldStatus,
          new_status: 'checked-in',
          changed_by: checkedInBy,
          change_reason: 'Patient checked in for appointment',
        },
        { transaction }
      );

      await transaction.commit();

      return await this.getAppointmentById(appointmentId);
    } catch (error) {
      await transaction.rollback();
      console.error('Check-in appointment error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to check in appointment', 500);
    }
  }

  // update appointments
  async extendAppointment(appointmentId, additionalMinutes, updatedBy) {
    const transaction = sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }

      if (!appointment.canExtend()) {
        throw new AppError(
          'Only in-progress or checked-in appointments can be extended',
          400
        );
      }

      const newDuration = appointment.duration_minutes + additionalMinutes;

      const pricing = await this.calculateAppointmentFee(
        appointment.doctor_id,
        appointment.department_id,
        appointment.appointment_type,
        newDuration
      );

      const [hours, minutes] = appointment.start_time.split(':');
      const startDate = new Date();
      startDate.setHours(parseInt(hours), parseInt(minutes), 0);
      const endDate = new Date(startDate.getTime() + newDuration + 60000);
      const newEndTime = format(endDate, 'HH:mm:ss');

      // update the appointment using appt_id
      await appointment.update(
        {
          duration_minutes: newDuration,
          time_extended_minutes: pricing.extendedMinutes,
          end_time: newEndTime,
          extension_fee: pricing.extensionFee,
          total_amount: pricing.totalAmount,
        },
        { transaction }
      );

      // log update history
      await Appointment.create(
        {
          appointment_id: appointment.appointment_id,
          action_type: 'update',
          changed_by: updatedBy,
          change_reason: `Extended by ${additionalMinutes} minutes`,
        },
        { transaction }
      );

      await transaction.commit();

      return await this.getAppointmentById(appointment.appointment_id);
    } catch (error) {
      await transaction.rollback();
      console.error('Extend appointment error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to extend appointment', 500);
    }
  }

  async cancelAppointment(appointmentId, reason, cancelledBy) {
    const transaction = await sequelize.transaction();

    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found.', 404);
      }

      if (!appointment.canCancel()) {
        throw new AppError('This appointment cannot be cancelled.', 400);
      }

      const oldStatus = appointment.status;

      await appointment.update(
        {
          status: 'cancelled',
          payment_status: 'cancelled',
          cancelled_at: new Date(),
          reason: appointment.notes
            ? `${appointment.notes}\n\nCancellation reason: ${reason}`
            : `Cancellation reason: ${reason}`,
        },
        { transaction }
      );

      await AppointmentHistory.create(
        {
          appointment_id: appointment.appointment_id,
          action_type: 'cancelled',
          previous_status: oldStatus,
          new_status: 'cancelled',
          changed_by: cancelledBy,
          change_reason: reason,
        },
        { transaction }
      );

      await transaction.commit();

      return await this.getAppointmentById(appointmentId);
    } catch (error) {
      await transaction.rollback();
      console.log('Cancel Appointment error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to cancel appointment', 500);
    }
  }

  async rescheduleAppointment(appointmentId, newDate, newTime, changedBy) {
    const transaction = await sequelize.transaction();

    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }

      if (!appointment.canReschedule()) {
        throw new AppError('This appointment cannot be rescheduled', 400);
      }

      const hasConflict = await Appointment.hasConflict(
        appointment.doctor_id,
        newDate,
        newTime,
        appointmentId
      );

      if (hasConflict) {
        throw new AppError('New time slot is already booked', 400);
      }

      const oldDate = appointment.appointment_date;
      const oldTime = appointment.start_time;

      const [hours, minutes] = newTime.split(':');
      const startDate = new Date();
      startDate.getHours(parseInt(hours), parseInt(minutes), 0);
      const endDate = new Date(
        startDate.getTime() + appointment.duration_minutes * 60000
      );

      const newEndTime = format(endDate, 'HH:mm:ss');

      await appointment.update(
        {
          appointment_date: newDate,
          appointment_time: newTime,
          start_time: newTime,
          end_time: newEndTime,
          status: 'rescheduled',
        },
        { transaction }
      );

      await AppointmentHistory.create(
        {
          appointment_id: appointmentId,
          action_type: 'rescheduled',
          previous_date: oldDate,
          new_date: newDate,
          previous_time: oldTime,
          new_time: newTime,
          changed_by: changedBy,
          change_reason: 'Appointment Rescheduled',
        },
        { transaction }
      );
      await transaction.commit();

      return await this.getAppointmentById(appointmentId);
    } catch (error) {
      await transaction.rollback();
      console.log('Resched appointment error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to resched appointment', 500);
    }
  }

  async getAppointmentTypes() {
    return [
      {
        value: 'consultation',
        label: 'General Consultation',
        description: 'Regular check-up or consultation',
      },
      {
        value: 'follow_up',
        label: 'Follow-up Visit',
        description: 'Follow-up from previous appointment',
      },
      {
        value: 'procedure',
        label: 'Medical Procedure',
        description: 'Scheduled medical procedure',
      },
      // {
      //   value: 'emergency',
      //   label: 'Emergency',
      //   description: 'Urgent medical attention required',
      // },
      {
        value: 'telemedicine',
        label: 'Telemedicine',
        description: 'Online video consultation',
      },
    ];
  }

  async updateAppointmentStatus(appointmentId, newStatus, updatedBy) {
    const transaction = await sequelize.transaction();

    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }

      const validStatuses = [
        'scheduled',
        'confirmed',
        'checked_in',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ];

      if (!validStatuses.includes(newStatus)) {
        throw new AppError('Invalid status', 400);
      }

      const oldStatus = appointment.status;

      await appointment.update({ status: newStatus }, { transaction });

      // Log to history
      await AppointmentHistory.create(
        {
          appointment_id: appointmentId,
          action_type: 'status_change',
          previous_status: oldStatus,
          new_status: newStatus,
          changed_by: updatedBy,
          change_reason: `Status changed from ${oldStatus} to ${newStatus}`,
        },
        { transaction }
      );

      await transaction.commit();
      return await this.getAppointmentById(appointmentId);
    } catch (error) {
      await transaction.rollback();
      console.log('Update appointment status error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Update appointment status failed.', 500);
    }
  }
  // process appointment payment
  async processPayment(appointmentId, paymentData) {
    const transaction = await sequelize.transaction();

    try {
      const {
        amount,
        payment_method,
        transaction_references,
        processed_by,
        notes,
      } = paymentData;

      const appointment = await Appointment.findByPk(appointmentId, {
        transaction,
      });

      if (!appointment) {
        throw new AppError('Appointment not found', 404);
      }

      const payment = await AppointmentPayment.create(
        {
          appointment_id: appointment.appointment_id,
          amount,
          payment_method,
          transaction_references,
          payment_status: 'completed',
          paid_at: new Date(),
          processed_by,
          notes,
        },
        { transaction }
      );

      const totalPaid = await AppointmentPayment.getTotalPaid(appointmentId);

      if (totalPaid >= parseFloat(appointment.total_amount)) {
        await appointment.update({ payment_status: 'paid' }, { transaction });
      }
      await transaction.commit();

      return payment;
    } catch (error) {
      await transaction.rollback();
      console.log('Payment failed: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Process payment failed.', 500);
    }
  }

  async getPaymentHistory(appointmentId) {}
}

export default new AppointmentService();
