import AppError from '../../../shared/utils/AppError.util.js';
import {
  Appointment,
  Notification,
  Patient,
  Person,
  sequelize,
  Staff,
  User,
  VideoConsultation,
  VideoWaitingRoom,
} from '../../../shared/models/index.js';
import { Op } from 'sequelize';
import { emitToRoom } from '../../../shared/utils/socketEmitter.js';
import moment from 'moment-timezone';

class VideoCallService {
  async getTodaysOnlineConsultation(userId, role, filters = {}) {
    try {
      let appointmentToday;

      const startOfDay = moment.tz('Asia/Manila').startOf('day').toDate();
      const endOfDay = moment.tz('Asia/Manila').endOf('day').toDate();

      const { page, limit } = filters;
      if (role === 'doctor') {
        const doctor = await Staff.findOne({
          where: { staff_uuid: userId },
        });

        if (!doctor) {
          throw new AppError('Doctor not found.', 404);
        }

        const appointments = await Appointment.findAll({
          where: {
            doctor_id: doctor.staff_id,
            is_online_consultation: true,
            appointment_date: { [Op.between]: [startOfDay, endOfDay] },
            status: ['scheduled', 'confirmed', 'checked_in', 'in_progress'],
          },
          include: [
            {
              model: Patient,
              as: 'patient',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: ['first_name', 'last_name', 'middle_name'],
                },
              ],
              attributes: ['patient_id', 'patient_uuid'],
            },
            {
              model: VideoConsultation,
              as: 'videoConsultation',
              attributes: [
                'consultation_id',
                'room_id',
                'status',
                'started_at',
                'ended_at',
                'doctor_joined_at',
                'patient_joined_at',
              ],
            },
          ],
          order: [['appointment_time', 'ASC']],
        });

        appointmentToday = appointments.map(apt => {
          const patient = apt.patient?.person;
          const patientName = patient
            ? `${patient.first_name} ${
                patient.middle_name ? patient.middle_name.charAt(0) + '.' : ''
              } ${patient.last_name}`.trim()
            : 'Unknown Patient';

          return {
            appointment_id: apt.appointment_id,
            appointment_number: apt.appointment_number,
            room_id: apt.videoConsultation?.room_id,
            consultation_id: apt.videoConsultation?.consultation_id,
            consultation_status: apt.videoConsultation?.status || 'not_created',

            // Patient info
            patient_name: patientName,
            patient_id: apt.patient_id,
            patient_uuid: apt.patient?.patient_uuid,

            // Time info
            appointment_date: apt.appointment_date,
            appointment_time: apt.appointment_time,
            start_time: apt.start_time,
            end_time: apt.end_time,
            duration: apt.duration_minutes,

            // Status
            status: apt.status,
            reason: apt.reason,
            appointment_type: apt.appointment_type,

            // Session info
            is_active: apt.videoConsultation?.status === 'in_progress',
            has_started: !!apt.videoConsultation?.started_at,
            has_ended: !!apt.videoConsultation?.ended_at,
            doctor_joined: !!apt.videoConsultation?.doctor_joined_at,
            patient_joined: !!apt.videoConsultation?.patient_joined_at,
          };
        });
      } else if (role === 'patient') {
        const patient = await Patient.findOne({
          where: { patient_uuid: userId },
        });

        if (!patient) {
          throw new AppError('Patient not found.', 404);
        }

        const appointments = await Appointment.findAll({
          where: {
            patient_id: patient.patient_id,
            is_online_consultation: true,
            appointment_date: phToday,
            status: {
              [Op.in]: ['scheduled', 'confirmed', 'checked_in', 'in_progress'],
            },
          },
          include: [
            {
              model: Staff,
              as: 'doctor',
              attributes: ['staff_id', 'staff_uuid'],
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: ['first_name', 'middle_name', 'last_name'],
                },
              ],
            },
            {
              model: VideoConsultation,
              as: 'videoConsultation',
              attributes: [
                'consultation_id',
                'room_id',
                'status',
                'started_at',
                'ended_at',
                'doctor_joined_at',
                'patient_joined_at',
              ],
            },
          ],
          order: [['appointment_time', 'ASC']],
        });
        appointmentToday = appointments.map(apt => {
          const doctor = apt.doctor?.person;
          const doctorName = doctor
            ? `Dr. ${doctor.first_name} ${
                doctor.middle_name ? doctor.middle_name.charAt(0) + '.' : ''
              } ${doctor.last_name}`.trim()
            : 'Unknown Doctor';

          return {
            appointment_id: apt.appointment_id,
            appointment_number: apt.appointment_number,
            room_id: apt.videoConsultation?.room_id,
            consultation_id: apt.videoConsultation?.consultation_id,
            consultation_status: apt.videoConsultation?.status || 'not_created',

            // Doctor info
            doctor_name: doctorName,
            doctor_id: apt.doctor_id,
            doctor_uuid: apt.doctor?.staff_uuid,

            // Time info
            appointment_date: apt.appointment_date,
            appointment_time: apt.appointment_time,
            start_time: apt.start_time,
            end_time: apt.end_time,
            duration: apt.duration_minutes,

            // Status
            status: apt.status,
            reason: apt.reason,
            appointment_type: apt.appointment_type,

            // Session info
            is_active: apt.videoConsultation?.status === 'in_progress',
            has_started: !!apt.videoConsultation?.started_at,
            has_ended: !!apt.videoConsultation?.ended_at,
            doctor_joined: !!apt.videoConsultation?.doctor_joined_at,
            patient_joined: !!apt.videoConsultation?.patient_joined_at,
          };
        });
      }

      return appointmentToday;
    } catch (error) {
      console.log('Get today online consultation error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Get consultation error', 500);
    }
  }

  async createRoom(appointmentId, doctorId) {
    const transaction = await sequelize.transaction();

    try {
      const appointment = await Appointment.findOne({
        where: { appointment_id: appointmentId },
        include: [
          {
            model: Patient,
            as: 'patient',
            include: [
              {
                model: Person,
                as: 'person',
                include: [
                  { model: User, as: 'user', attributes: ['user_uuid'] },
                ],
              },
            ],
          },
        ],
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!appointment) {
        throw new AppError('No appointment found.', 404);
      }

      if (doctorId && appointment.doctor_id !== doctorId) {
        throw new AppError('No appointment found with logged in doctor.', 404);
      }

      const existingConsultation = await VideoConsultation.findOne({
        where: { appointment_id: appointmentId },
        transaction,
      });

      if (existingConsultation) {
        throw new AppError('Room already exists.', 400);
      }

      const roomId = `room-${appointmentId}_${Date.now()}`;
      const consultation = await VideoConsultation.create(
        {
          appointment_id: appointmentId,
          room_id: roomId,
          status: 'scheduled',
        },
        { transaction }
      );

      await Appointment.update(
        {
          is_online_consultation: true,
          video_consultation_id: consultation.consultation_id,
        },
        { where: { appointment_id: appointmentId }, transaction }
      );

      const receiverUuid = appointment?.patient?.person?.user?.user_uuid;
      const lastname = appointment?.patient?.person?.last_name;

      await Notification.create(
        {
          user_uuid: receiverUuid,
          type: 'room_created',
          title: 'Online consultation room created',
          message: `Your room for your appointment for ${appointment?.appointment_date} is room ${roomId}`,
          data: JSON.stringify(consultation),
        },
        { transaction }
      );

      await transaction.commit();

      const roomName = `${receiverUuid}_${lastname}`;
      await emitToRoom(roomName, 'video:room-created', consultation);

      return consultation;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
        console.log('Transaction rolled back');
      }

      console.error('Create online room error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Create room error', 500);
    }
  }

  async getRoomDetails(roomId, userId, role) {
    try {
      const consultation = await VideoConsultation.findOne({
        where: { appointment_id: roomId },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            include: [
              {
                model: Patient,
                as: 'patient',
                include: [
                  {
                    model: Person,
                    as: 'person',
                    attributes: ['first_name', 'last_name', 'person_id'],
                  },
                ],
                model: Staff,
                as: 'doctor',
                include: [
                  {
                    model: Person,
                    as: 'person',
                    attributes: ['first_name', 'last_name', 'person_id'],
                  },
                ],
              },
            ],
          },
        ],
      });

      if (!consultation) {
        throw new AppError('Online consultation not found.', 404);
      }

      const appointment = consultation.appointment;
      let hasAccess = false;

      if (role === 'doctor') {
        const staff = await Staff.findOne({
          where: { staff_uuid: userId },
        });
        hasAccess = staff && staff.staff_id === appointment.doctor_id;
      } else if (role === 'patient') {
        const user = await User.findOne({
          where: { user_uuid: userId },
          include: [
            {
              model: Person,
              as: 'person',
              include: [{ model: Patient, as: 'patient' }],
            },
          ],
        });
        hasAccess =
          user && user.person.patient_id === appointment.appointment_id;
      }

      if (!hasAccess) {
        throw new AppError('You do not have access to this consultation', 403);
      }

      return consultation;
    } catch (error) {
      console.log('Get room details error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Get room details failed.', 500);
    }
  }

  async DeleteRoom(roomId, doctorId) {
    const transaction = await sequelize.transaction();
    try {
      const doctor = await Staff.findOne({
        where: { staff_uuid: doctorId },
        transaction,
      });

      const consultation = await VideoConsultation.findOne({
        where: { appointment_id: roomId },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            where: doctorId ? { doctor_id: doctor.staff_id } : {},
          },
        ],
        transaction,
      });

      if (!consultation) {
        throw new AppError(
          'Video consultation with logged in doctor not found',
          404
        );
      }

      if (consultation.status === 'in_progress') {
        throw new AppError(
          'Cannot delete consultation that is in progress',
          400
        );
      }

      await VideoConsultation.destroy({
        where: { consultation_id: consultation.consultation_id },
        transaction,
      });

      const [updatedCount] = await Appointment.update(
        {
          is_online_consultation: false,
          video_consultation_id: null,
        },
        { where: { appointment_id: consultation.appointment_id }, transaction }
      );

      if (updatedCount === 0) {
        throw new AppError('Failed to update appointment', 500);
      }

      await transaction.commit();

      return { message: 'Room deleted successfully' };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Delete room error:', error.message);

      throw error instanceof AppError
        ? error
        : new AppError('Failed to delete room', 500);
    }
  }

  async joinRoom(roomId, userId, userType, peerId, socketId) {
    const transaction = await sequelize.transaction();
    try {
      // get the consultation room
      const consultation = await VideoConsultation.findOne({
        where: { room_id: roomId, status: { [Op.ne]: 'completed' } },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            required: true,
            include: [
              {
                model: Patient,
                as: 'patient',
                include: [
                  {
                    model: Person,
                    as: 'person',
                    include: [
                      { model: User, as: 'user', attributes: ['user_id'] },
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
                    include: [
                      { model: User, as: 'user', attributes: ['user_id'] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        transaction,
      });

      if (!consultation) {
        throw new AppError('No consultation room found.', 404);
      }

      const appointment = consultation.appointment;

      const patientUserId = appointment.patient?.person?.user?.user_id;
      const doctorUserId = appointment.doctor?.person?.user?.user_id;

      let hasPermission = false;

      if (userType === 'patient') {
        hasPermission = patientUserId === userId;
      } else if (userType === 'doctor') {
        hasPermission = doctorUserId === userId;
      }

      if (!hasPermission) {
        throw new AppError(
          'You do not have permission to join this consultation room.',
          403
        );
      }

      const existingEntry = await VideoWaitingRoom.findOne({
        where: {
          appointment_id: appointment.appointment_id,
          user_id: userId,
          user_type: userType,
          status: { [Op.in]: ['joined', 'waiting'] },
        },
        transaction,
      });

      if (existingEntry) {
        throw new AppError('You are already in this consultation room.', 400);
      }

      await VideoWaitingRoom.upsert(
        {
          appointment_id: appointment.appointment_id,
          user_id: userId,
          user_type: userType,
          checked_in_at: Date.now(),
          peer_id: peerId,
          socket_id: socketId,
          is_ready: true,
          status: 'waiting',
          disconnect_reason: null,
        },
        { transaction }
      );

      const updateField =
        userType === 'doctor' ? 'doctor_joined_at' : 'patient_joined_at';

      await consultation.update(
        {
          [updateField]: Date.now(),
        },
        { transaction }
      );

      const bothJoined =
        consultation.doctor_joined_at && consultation.patient_joined_at;

      if (bothJoined) {
        const startTime = new Date(Date.now());
        const expectedEndTime = new Date(startTime.getTime() + 30 * 60 * 1000);
        await consultation.update(
          {
            started_at: startTime,
            status: 'in_progress',
          },
          { transaction }
        );

        await Appointment.update(
          {
            status: 'in_progress',
            start_time: startTime,
            end_time: expectedEndTime,
          },
          { where: { appointment_id: appointment.appointment_id }, transaction }
        );
      } else {
        await consultation.update({ status: 'waiting' }, { transaction });
        await Appointment.update(
          {
            status: 'arrived',
          },
          { where: { appointment_id: appointment.appointment_id }, transaction }
        );
      }

      await transaction.commit();

      const otherUserType = userType === 'doctor' ? 'patient' : 'doctor';
      const otherParticipant = await VideoWaitingRoom.findOne({
        where: {
          appointment_id: appointment.appointment_id,
          user_type: otherUserType,
          status: 'waiting',
        },
      });

      return {
        roomId: consultation.room_id,
        consultationId: consultation.consultation_id,
        userType,
        otherParticipant: otherParticipant
          ? {
              peerId: otherParticipant.peer_id,
              socketId: otherParticipant.socket_id,
              isReady: otherParticipant.is_ready,
            }
          : null,
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      console.error('Join room error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to join room', 500);
    }
  }

  async leaveRoom(roomId, userId, userType, durationSeconds) {
    const transaction = await sequelize.transaction();

    try {
      const consultation = await VideoConsultation.findOne({
        where: { room_id: roomId, status: { [Op.ne]: 'completed' } },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            include: [
              {
                model: Patient,
                as: 'patient',
                include: [
                  {
                    model: Person,
                    as: 'person',
                    include: [
                      { model: User, as: 'user', attributes: ['user_id'] },
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
                    include: [
                      { model: User, as: 'user', attributes: ['user_id'] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        transaction,
      });

      if (!consultation) {
        throw new AppError('Online consultation not found.', 404);
      }

      const appointment = consultation.appointment;
      const patientUserId = appointment.patient?.person?.user?.user_id;
      const doctorUserId = appointment.doctor?.person?.user?.user_id;

      const hasPermission =
        (userType === 'patient' && patientUserId === userId) ||
        (userType === 'doctor' && doctorUserId === userId);

      if (!hasPermission) {
        throw new AppError(
          'You do not have permission to leave this consultation',
          403
        );
      }

      // Mark user as left in waiting room
      const waitingEntry = await VideoWaitingRoom.findOne({
        where: {
          appointment_id: appointment.appointment_id,
          user_id: userId,
          user_type: userType,
        },
        transaction,
      });

      if (waitingEntry) {
        waitingEntry.status = 'left';
        waitingEntry.socket_id = null;
        waitingEntry.is_ready = false;
        await waitingEntry.save({ transaction });
      }

      // Check if both participants have left
      const waitingRoomEntries = await VideoWaitingRoom.findAll({
        where: {
          appointment_id: appointment.appointment_id,
        },
        attributes: ['user_type', 'status'],
        transaction,
      });

      const doctorEntry = waitingRoomEntries.find(
        e => e.user_type === 'doctor'
      );
      const patientEntry = waitingRoomEntries.find(
        e => e.user_type === 'patient'
      );

      // Check if consultation has actually started (both joined at some point)
      const consultationStarted = consultation.started_at !== null;
      const bothParticipantsJoined = doctorEntry && patientEntry;

      const doctorStillWaiting =
        doctorEntry && doctorEntry.status === 'waiting';
      const patientStillWaiting =
        patientEntry && patientEntry.status === 'waiting';
      const bothLeft = !patientStillWaiting && !doctorStillWaiting;

      if (
        consultationStarted &&
        bothParticipantsJoined &&
        bothLeft &&
        consultation.status !== 'completed'
      ) {
        const actualDurationMinutes = Math.ceil(durationSeconds / 60);
        const scheduledDuration = appointment.duration_minutes || 30;

        // Calculate extension time
        const extensionMinutes = Math.max(
          0,
          actualDurationMinutes - scheduledDuration
        );

        // Calculate extension fee (PHP 15 per minute)
        const extensionFeePerMinute = 15.0;
        const extensionFee = extensionMinutes * extensionFeePerMinute;

        // Update consultation
        consultation.ended_at = new Date();
        consultation.duration_seconds = durationSeconds;
        consultation.status = 'completed';
        await consultation.save({ transaction });

        // Update appointment
        appointment.status = 'completed';
        appointment.end_time = new Date();
        appointment.duration_minutes = actualDurationMinutes;
        appointment.time_extended_minutes = extensionMinutes;

        if (extensionMinutes > 0) {
          appointment.extension_fee = extensionFee;
          appointment.total_amount =
            parseFloat(appointment.total_amount || 0) +
            parseFloat(extensionFee);
        }

        await appointment.save({ transaction });

        // Notify next appointment if delayed
        if (extensionMinutes > 0) {
          await this.checkAndNotifyNextAppointment(
            appointment.doctor_id,
            appointment.appointment_date,
            appointment.appointment_time,
            extensionMinutes,
            transaction
          );
        }
      } else if (!bothLeft) {
        const stillInCall = [];
        if (doctorStillWaiting) stillInCall.push('doctor');
        if (patientStillWaiting) stillInCall.push('patient');
      } else if (consultation.status === 'completed') {
        console.log('Consultation already completed');
      }

      await transaction.commit();

      const consultationEnded =
        consultationStarted &&
        bothParticipantsJoined &&
        bothLeft &&
        consultation.status === 'completed';

      return {
        message: consultationEnded
          ? 'Consultation ended successfully.'
          : 'Left consultation successfully.',
        consultationEnded: bothLeft && consultation.status === 'completed',
        canRejoin: consultation.status !== 'completed',
        roomId,
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      console.error('Leave room error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to leave room', 500);
    }
  }

  async rejoinRoom(roomId, userId, userType, peerId, socketId) {
    const transaction = await sequelize.transaction();
    try {
      const consultation = await VideoConsultation.findOne({
        where: { room_id: roomId, status: { [Op.ne]: 'completed' } },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            required: true,
          },
        ],
        transaction,
      });

      if (!consultation) {
        throw new AppError('Consultation room not found', 404);
      }

      // check first if the consultation ended before joining again
      if (consultation.status === 'completed') {
        throw new AppError('This consultation has already ended', 400);
      }

      const appointment = consultation.appointment;

      const waitingEntry = await VideoWaitingRoom.findOne({
        where: {
          appointment_id: appointment.appointment_id,
          user_id: userId,
          user_type: userType,
          status: { [Op.in]: ['left', 'disconnected'] },
        },
        transaction,
      });

      if (!waitingEntry) {
        throw new AppError('You were not part of this consultation', 403);
      }

      waitingEntry.status = 'waiting';
      waitingEntry.socket_id = socketId;
      waitingEntry.peer_id = peerId;
      waitingEntry.is_ready = true;
      waitingEntry.checked_in_at = new Date();
      await waitingEntry.save({ transaction });

      if (consultation.status === 'waiting') {
        const bothPresent = await VideoWaitingRoom.count({
          where: {
            appointment_id: appointment.appointment_id,
            status: 'waiting',
          },
          transaction,
        });

        if (bothPresent === 2) {
          consultation.status = 'in_progress';
          await consultation.save({ transaction });
        }
      }
      await transaction.commit();

      const otherUserType = userType === 'patient' ? 'doctor' : 'patient';
      const otherParticipant = await VideoWaitingRoom.findOne({
        where: {
          appointment_id: appointment.appointment_id,
          user_type: otherUserType,
          status: 'waiting',
        },
      });

      return {
        message: 'Rejoined consultation successfully',
        roomId: consultation.room_id,
        consultationId: consultation.consultation_id,
        appointmentId: appointment.appointment_id,
        userType,
        scheduledDuration: appointment.duration_minutes || 30,
        otherParticipant: otherParticipant
          ? {
              peerId: otherParticipant.peer_id,
              socketId: otherParticipant.socket_id,
              isReady: otherParticipant.is_ready,
            }
          : null,
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      console.error('Rejoin room error:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to rejoin room', 500);
    }
  }

  async userDisconnect(socketId, userId, userType) {
    const transaction = await sequelize.transaction();
    try {
      const waitingEntry = await VideoWaitingRoom.findOne({
        where: {
          user_id: userId,
          user_type: userType,
          socket_id: socketId,
          status: { [Op.in]: ['joined', 'waiting'] },
        },
        transaction,
      });

      if (waitingEntry) {
        waitingEntry.status = 'left';
        waitingEntry.left_at = new Date();
        waitingEntry.is_ready = false;
        waitingEntry.disconnect_reason = 'socket_disconnect';
        await waitingEntry.save({ transaction });
      }

      await transaction.commit();
      return { success: true };
    } catch (error) {
      await transaction.rollback();
      console.error('Disconnect handling error:', error);
      throw error;
    }
  }

  async getRoomStatus(roomId, userId, userType) {
    try {
      const consultation = await VideoConsultation.findOne({
        where: { room_id: roomId },
        include: [
          {
            model: Appointment,
            as: 'appointment',
            required: true,
          },
        ],
      });

      if (!consultation) {
        return {
          exists: false,
          canJoin: false,
          canRejoin: false,
          isCompleted: false,
        };
      }

      const isCompleted = consultation.status === 'completed';

      // Check if user was in the room and disconnected
      const leftEntry = await VideoWaitingRoom.findOne({
        where: {
          appointment_id: consultation.appointment.appointment_id,
          user_id: userId,
          user_type: userType,
          status: 'left',
          disconnect_reason: 'socket_disconnect',
        },
      });

      // Check if currently active
      const activeEntry = await VideoWaitingRoom.findOne({
        where: {
          appointment_id: consultation.appointment.appointment_id,
          user_id: userId,
          user_type: userType,
          status: { [Op.in]: ['joined', 'waiting'] },
        },
      });

      const canRejoin =
        !!leftEntry &&
        leftEntry.disconnect_reason === 'socket_disconnect' &&
        !isCompleted;

      const canJoin = !isCompleted && !activeEntry && !canRejoin;

      return {
        exists: true,
        canJoin,
        canRejoin,
        isCompleted,
        isActive: !!activeEntry,
        consultation: {
          roomId: consultation.room_id,
          status: consultation.status,
          appointmentId: consultation.appointment.appointment_id,
        },
      };
    } catch (error) {
      console.error('Check room status error:', error);
      throw error;
    }
  }

  async checkAndNotifyNextAppointment(
    doctorId,
    currentDate,
    currentTime,
    delayMinutes,
    transaction
  ) {
    try {
      const nextAppointment = await Appointment.findOne({
        where: {
          doctor_id: doctorId,
          appointment_date: currentDate,
          appointment_time: {
            [Op.gt]: currentTime,
          },
          status: ['scheduled', 'confirmed'],
        },
        order: [['appointment_time', 'ASC']],
        transaction,
      });

      if (nextAppointment) {
        // Send notification to patient about delay
        // You can emit socket event or send notification
        console.log(`⏰ Next appointment delayed by ${delayMinutes} minutes`);

        // Emit socket event
        global.io
          ?.to(`appointment-${nextAppointment.appointment_id}`)
          .emit('appointment-delay', {
            delayMinutes,
            message: `Your appointment may be delayed by approximately ${delayMinutes} minutes due to the previous consultation running over.`,
          });
      }
    } catch (error) {
      console.error('Error checking next appointment:', error);
    }
  }
}

export default new VideoCallService();
