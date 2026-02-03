import cron from 'node-cron';
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

import {
  Appointment,
  Patient,
  Person,
  User,
  Notification,
  Staff,
  VideoConsultation, // Import this!
} from '../../../shared/models/index.js';
import { emitToRoom } from '../../../shared/utils/socketEmitter.js';

class AppointmentReminderService {
  constructor() {
    this.schedule = cron.schedule('* * * * *', async () => {
      try {
        await this.checkAndSendReminders();
      } catch (error) {
        console.error('Reminder service error:', error);
      }
    });

    this.schedule.start();
    console.log(
      '✅ Appointment reminder service initialized - running every minute',
    );
  }

  async checkAndSendReminders() {
    const now = dayjs();
    const currentDate = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm:ss');

    console.log(`🕐 Checking reminders at ${currentDate} ${currentTime}`);

    try {
      await this.checkOneDayReminders();
      await this.checkOneHourReminders();
      await this.checkFiveMinuteReminders();
    } catch (error) {
      console.error('Error in reminder check:', error);
    }
  }

  async checkOneDayReminders() {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

    const appointments = await Appointment.findAll({
      where: {
        appointment_date: tomorrow,
        status: { [Op.in]: ['scheduled', 'confirmed'] },
        one_day_reminder_sent: false,
      },
      include: [
        {
          model: Patient,
          as: 'patient',
          required: true,
          include: [
            {
              model: Person,
              as: 'person',
              required: true,
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['user_uuid', 'email', 'phone'],
                },
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
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
      ],
    });

    for (const appointment of appointments) {
      try {
        await this.sendOneDayReminder(appointment);
      } catch (error) {
        console.error(
          `Failed to send 1-day reminder for appointment ${appointment.appointment_id}:`,
          error,
        );
      }
    }
  }

  async checkOneHourReminders() {
    const today = dayjs().format('YYYY-MM-DD');
    const oneHourFromNow = dayjs().add(1, 'hour');
    const now = dayjs();

    const appointments = await Appointment.findAll({
      where: {
        appointment_date: today,
        is_online_consultation: false,
        status: { [Op.in]: ['scheduled', 'confirmed'] },
        one_hour_reminder_sent: false,
      },
      include: [
        {
          model: Patient,
          as: 'patient',
          required: true,
          include: [
            {
              model: Person,
              as: 'person',
              required: true,
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['user_uuid', 'email', 'phone'],
                },
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
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
      ],
    });

    const filteredAppointments = appointments.filter(appointment => {
      const appointmentTime = dayjs(`${today} ${appointment.start_time}`);
      return (
        appointmentTime.isSameOrAfter(now) &&
        appointmentTime.isSameOrBefore(oneHourFromNow)
      );
    });

    for (const appointment of filteredAppointments) {
      try {
        await this.sendOneHourReminder(appointment);
      } catch (error) {
        console.error(
          `Failed to send 1-hour reminder for appointment ${appointment.appointment_id}:`,
          error,
        );
      }
    }
  }

  async checkFiveMinuteReminders() {
    const today = dayjs().format('YYYY-MM-DD');
    const fiveMinFromNow = dayjs().add(5, 'minute');
    const now = dayjs();

    const appointments = await Appointment.findAll({
      where: {
        appointment_date: today,
        is_online_consultation: true,
        status: { [Op.in]: ['scheduled', 'confirmed'] },
        five_min_reminder_sent: false,
      },
      include: [
        {
          model: Patient,
          as: 'patient',
          required: true,
          include: [
            {
              model: Person,
              as: 'person',
              required: true,
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['user_uuid', 'email', 'phone'],
                },
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
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
        {
          model: VideoConsultation, // Include video consultation to get room_id
          as: 'videoConsultation',
          attributes: ['room_id'],
        },
      ],
    });

    const filteredAppointments = appointments.filter(appointment => {
      const appointmentTime = dayjs(`${today} ${appointment.start_time}`);
      return (
        appointmentTime.isSameOrAfter(now) &&
        appointmentTime.isSameOrBefore(fiveMinFromNow)
      );
    });

    for (const appointment of filteredAppointments) {
      try {
        await this.sendFiveMinuteReminder(appointment);
      } catch (error) {
        console.error(
          `Failed to send 5-minute reminder for appointment ${appointment.appointment_id}:`,
          error,
        );
      }
    }
  }

  async sendOneDayReminder(appointment) {
    try {
      const patientUserUuid = appointment.patient?.person?.user?.user_uuid;

      if (!patientUserUuid) {
        console.warn(
          `No user UUID found for patient in appointment ${appointment.appointment_id}`,
        );
        return;
      }

      const doctorName =
        `${appointment.doctor?.person?.first_name || ''} ${appointment.doctor?.person?.last_name || ''}`.trim();
      const appointmentType = appointment.is_online_consultation
        ? 'Online Consultation'
        : 'In-Person Appointment';

      // Create notification
      const notification = await Notification.create({
        user_uuid: patientUserUuid,
        type: 'appointment_reminder',
        title: 'Appointment Reminder - Tomorrow',
        message: `Your ${appointmentType} with Dr. ${doctorName} is scheduled for tomorrow at ${appointment.start_time}.`,
        data: JSON.stringify({
          appointment_id: appointment.appointment_id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.start_time,
          doctor_name: doctorName,
          is_online: appointment.is_online_consultation,
          type: '1_day_reminder',
        }),
      });

      // Send socket notification with appointment details
      await emitToRoom(`user-${patientUserUuid}`, 'appointment_reminder', {
        type: '1_day_before',
        appointmentId: appointment.appointment_id,
        message: notification.message,
        time: appointment.start_time,
        date: appointment.appointment_date,
        doctorName: doctorName,
        isOnline: appointment.is_online_consultation,
      });

      await appointment.update({
        one_day_reminder_sent: true,
        reminder_sent_at: new Date(),
      });

      console.log(
        `✅ 1-day reminder sent for appointment ${appointment.appointment_id}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to send 1-day reminder for ${appointment.appointment_id}:`,
        error,
      );
    }
  }

  async sendOneHourReminder(appointment) {
    try {
      const patientUserUuid = appointment.patient?.person?.user?.user_uuid;

      if (!patientUserUuid) {
        console.warn(
          `No user UUID found for patient in appointment ${appointment.appointment_id}`,
        );
        return;
      }

      const doctorName =
        `${appointment.doctor?.person?.first_name || ''} ${appointment.doctor?.person?.last_name || ''}`.trim();

      const notification = await Notification.create({
        user_uuid: patientUserUuid,
        type: 'appointment_reminder',
        title: 'Appointment Reminder - 1 Hour',
        message: `Your in-person appointment with Dr. ${doctorName} starts in 1 hour at ${appointment.start_time}.`,
        data: JSON.stringify({
          appointment_id: appointment.appointment_id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.start_time,
          doctor_name: doctorName,
          type: '1_hour_reminder',
        }),
      });

      // Send socket notification
      await emitToRoom(`user-${patientUserUuid}`, 'appointment_reminder', {
        type: '1_hour_before',
        appointmentId: appointment.appointment_id,
        message: notification.message,
        time: appointment.start_time,
        isOnline: false,
      });

      await appointment.update({
        one_hour_reminder_sent: true,
        reminder_sent_at: new Date(),
      });

      console.log(
        `✅ 1-hour reminder sent for in-person appointment ${appointment.appointment_id}`,
      );
    } catch (error) {
      console.error(`❌ Failed to send 1-hour reminder:`, error);
    }
  }

  async sendFiveMinuteReminder(appointment) {
    try {
      const patientUserUuid = appointment.patient?.person?.user?.user_uuid;

      if (!patientUserUuid) {
        console.warn(
          `No user UUID found for patient in appointment ${appointment.appointment_id}`,
        );
        return;
      }

      const doctorName =
        `${appointment.doctor?.person?.first_name || ''} ${appointment.doctor?.person?.last_name || ''}`.trim();
      const roomId = appointment.videoConsultation?.room_id;
      const roomName = appointment.videoConsultation?.room_name;

      // Create notification with room info
      const notification = await Notification.create({
        user_uuid: patientUserUuid,
        type: 'appointment_reminder',
        title: 'Online Consultation Reminder - 5 Minutes',
        message: `Your online consultation with Dr. ${doctorName} starts in 5 minutes. Please join the waiting room.`,
        data: JSON.stringify({
          appointment_id: appointment.appointment_id,
          appointment_time: appointment.start_time,
          doctor_name: doctorName,
          room_id: roomId,
          room_name: roomName,
          join_link: roomId ? `/video-consultation/${roomId}` : null,
          type: '5_min_reminder',
          hasJoinButton: true, // Flag to show join button
        }),
      });

      // Send socket notification WITH ROOM_ID
      await emitToRoom(`user-${patientUserUuid}`, 'appointment_reminder', {
        type: '5_min_before',
        appointmentId: appointment.appointment_id,
        message: notification.message,
        joinLink: roomId ? `/video-consultation/${roomId}` : null,
        roomId: roomId,
        roomName: roomName,
        doctorName: doctorName,
        hasJoinButton: true, // Important for frontend
        appointmentTime: appointment.start_time,
      });

      await appointment.update({
        five_min_reminder_sent: true,
        reminder_sent_at: new Date(),
      });

      console.log(
        `✅ 5-minute reminder sent for online appointment ${appointment.appointment_id}, Room ID: ${roomId}`,
      );
    } catch (error) {
      console.error(`❌ Failed to send 5-minute reminder:`, error);
    }
  }
}

export default new AppointmentReminderService();
