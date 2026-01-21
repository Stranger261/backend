import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';
import { Op } from 'sequelize';

import AppError from '../../../shared/utils/AppError.util.js';
import {
  Appointment,
  Department,
  Patient,
  Person,
  sequelize,
  Staff,
  User,
} from '../../../shared/models/index.js';
import {
  broadcastToAll,
  emitToRoom,
} from '../../../shared/utils/socketEmitter.js';

class kioskService {
  constructor() {
    this.faceSetToken = process.env.FACEPP_FACESET_TOKEN;
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minDelay = 1500; // 1 sec and a half per request
    this.initializeFaceSet();
  }

  async initializeFaceSet() {
    try {
      if (!this.faceSetToken) {
        const newFaceSet = await this.createFaceSet();
        this.faceSetToken = newFaceSet.faceset_token;
      } else {
        const details = await this.getFaceSetDetails();
        console.log(`\n✅ FaceSet ready (${details.face_count} faces)\n`);
      }
    } catch (error) {
      console.error('❌ FaceSet init failed:', error.message);
    }
  }

  async createFaceSet() {
    return this.queueRequest(async () => {
      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('display_name', 'Hospital_Patient_Registry');
      formData.append('outer_id', `hms_faceset_${Date.now()}`);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/faceset/create',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 },
      );

      if (response.data.error_message) {
        throw new AppError(
          `FaceSet creation failed: ${response.data.error_message}`,
          500,
        );
      }

      return response.data;
    });
  }

  async getFaceSetDetails() {
    return this.queueRequest(async () => {
      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('faceset_token', this.faceSetToken);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/faceset/getdetail',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 },
      );

      return response.data;
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryWithBackoff(apiCall, maxRetries = 5) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries}...`);
        const result = await apiCall();
        return result;
      } catch (error) {
        console.log(error);
        lastError = error;
        const errorMsg = error.response?.data?.error_message || '';
        const statusCode = error.response?.status;
        const isConcurrency = errorMsg.includes('CONCURRENCY_LIMIT_EXCEEDED');
        const isRateLimit =
          statusCode === 403 || statusCode === 429 || isConcurrency;

        console.error(`❌ Failed (${statusCode}):`, errorMsg || error.message);

        if (isRateLimit && attempt < maxRetries) {
          const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        if (statusCode >= 400 && statusCode < 500 && !isRateLimit) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw new AppError(
            `Face++ failed after ${maxRetries} attempts: ${
              errorMsg || error.message
            }`,
            statusCode || 500,
          );
        }
      }
    }

    throw lastError;
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { apiCall, resolve, reject } = this.requestQueue.shift();

    try {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelay) {
        const waitTime = this.minDelay - timeSinceLastRequest;
        console.log(`⏳ Waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
      }

      this.lastRequestTime = Date.now();
      const result = await this.retryWithBackoff(apiCall);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      setImmediate(() => this.processQueue());
    }
  }

  async queueRequest(apiCall) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ apiCall, resolve, reject });
      this.processQueue();
    });
  }

  async detectAndCropFace(imageBuffer) {
    return this.queueRequest(async () => {
      try {
        let buffer;

        if (Buffer.isBuffer(imageBuffer)) {
          buffer = imageBuffer;
        } else if (typeof imageBuffer === 'string') {
          let base64Data = imageBuffer;

          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }

          buffer = Buffer.from(base64Data, 'base64');
          console.log('✅ Converted base64 string to buffer');
        } else {
          throw new AppError(
            'Invalid image format. Expected Buffer or base64 string.',
            400,
          );
        }

        if (!buffer || buffer.length === 0) {
          throw new AppError('Invalid image data', 400);
        }

        const formData = new FormData();
        formData.append('image_file', buffer, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });
        formData.append('api_key', process.env.FACEPP_API_KEY);
        formData.append('api_secret', process.env.FACEPP_API_SECRET);
        formData.append('return_attributes', 'blur,facequality');

        const response = await axios.post(
          'https://api-us.faceplusplus.com/facepp/v3/detect',
          formData,
          { headers: formData.getHeaders(), timeout: 30000 },
        );

        if (response.data.error_message) {
          throw new AppError(
            `Face detection failed: ${response.data.error_message}`,
            400,
          );
        }

        if (!response.data.faces || response.data.faces.length === 0) {
          throw new AppError(
            'No face detected. Please upload a clear photo.',
            400,
          );
        }

        if (response.data.faces.length > 1) {
          throw new AppError(
            'Multiple faces detected. Please use a photo with only one person.',
            400,
          );
        }

        const face = response.data.faces[0];
        const faceRect = face.face_rectangle;

        if (faceRect.width < 100 || faceRect.height < 100) {
          throw new AppError(
            'Face too small. Please upload a higher quality photo.',
            400,
          );
        }

        const blurValue = face.attributes?.blur?.blurriness?.value || 0;
        if (blurValue > 50) {
          throw new AppError(
            `Photo too blurry (${blurValue.toFixed(
              1,
            )}). Please upload clearer photo.`,
            400,
          );
        }

        const faceQuality = face.attributes?.facequality?.value || 85;
        if (faceQuality < 45) {
          throw new AppError(
            `Face quality too low (${faceQuality.toFixed(1)}/100).`,
            400,
          );
        }

        console.log('✅ Quality:', {
          size: `${faceRect.width}x${faceRect.height}`,
          blur: blurValue.toFixed(1),
          quality: faceQuality.toFixed(1),
        });

        // Crop face
        const metadata = await sharp(buffer).metadata();
        const padding = 0.3;

        const croppedFaceBuffer = await sharp(buffer)
          .extract({
            left: Math.max(
              0,
              Math.floor(faceRect.left - faceRect.width * padding),
            ),
            top: Math.max(
              0,
              Math.floor(faceRect.top - faceRect.height * padding),
            ),
            width: Math.min(
              metadata.width -
                Math.max(
                  0,
                  Math.floor(faceRect.left - faceRect.width * padding),
                ),
              Math.floor(faceRect.width * (1 + 2 * padding)),
            ),
            height: Math.min(
              metadata.height -
                Math.max(
                  0,
                  Math.floor(faceRect.top - faceRect.height * padding),
                ),
              Math.floor(faceRect.height * (1 + 2 * padding)),
            ),
          })
          .resize(600, 600, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 90 })
          .toBuffer();

        console.log('✅ Face cropped');

        return {
          croppedFaceBuffer,
          faceRectangle: faceRect,
          faceToken: face.face_token,
          faceQuality,
          qualityChecks: {
            blur: blurValue,
            quality: faceQuality,
            faceSize: { width: faceRect.width, height: faceRect.height },
          },
        };
      } catch (error) {
        console.error('Crop and detect face failed.', error.message);
        throw error instanceof AppError
          ? error
          : new AppError('Server failed.', 500);
      }
    });
  }

  async compareFaces(storedFaceToken, liveFaceToken) {
    return this.queueRequest(async () => {
      console.log('⚖️ Comparing faces...');

      if (!storedFaceToken || typeof storedFaceToken !== 'string') {
        throw new AppError('Invalid stored face token', 400);
      }

      if (!liveFaceToken || typeof liveFaceToken !== 'string') {
        console.error(
          '❌ Invalid liveFaceToken:',
          typeof liveFaceToken,
          liveFaceToken,
        );
        throw new AppError('Invalid live face token', 400);
      }

      console.log(`   Stored token: ${storedFaceToken.substring(0, 20)}...`);
      console.log(`   Live token: ${liveFaceToken.substring(0, 20)}...`);

      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('face_token1', storedFaceToken);
      formData.append('face_token2', liveFaceToken);

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/compare',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 },
      );

      if (response.data.error_message) {
        throw new AppError(
          `Comparison failed: ${response.data.error_message}`,
          400,
        );
      }

      const confidence = response.data.confidence;
      console.log(`✅ Comparison: ${confidence.toFixed(2)}% confidence`);

      return {
        confidence,
        thresholds: response.data.thresholds,
        is_match: confidence >= (response.data.thresholds['1e-5'] || 80),
        raw_response: response.data,
      };
    });
  }

  async searchFaceInFaceSet(faceToken) {
    return this.queueRequest(async () => {
      console.log('🔍 Searching FaceSet for duplicates...');

      const formData = new FormData();
      formData.append('api_key', process.env.FACEPP_API_KEY);
      formData.append('api_secret', process.env.FACEPP_API_SECRET);
      formData.append('faceset_token', this.faceSetToken);
      formData.append('face_token', faceToken);
      formData.append('return_result_count', '5'); // Get top 10 matches

      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/search',
        formData,
        { headers: formData.getHeaders(), timeout: 30000 },
      );

      if (response.data.error_message) {
        const errorMsg = response.data.error_message;

        // Empty FaceSet is OK
        if (
          errorMsg.includes('EMPTY_FACESET') ||
          errorMsg.includes('no face') ||
          errorMsg.includes('invalid faceset')
        ) {
          console.log('⚠️ FaceSet is empty');
          return [];
        }

        throw new AppError(`Face search failed: ${errorMsg}`, 400);
      }

      const results = response.data.results || [];

      return results;
    });
  }

  async verifyAppointmentArrival(livePhotoBase64) {
    const transaction = await sequelize.transaction();
    try {
      const currentDateTime = new Date();

      const liveDetection = await this.detectAndCropFace(livePhotoBase64);
      const liveFaceToken = liveDetection.faceToken;

      const matches = await this.searchFaceInFaceSet(liveFaceToken);

      if (matches.length === 0) {
        throw new AppError('No registered face found in the system.', 404);
      }

      const THRESHOLD = process.env.FACEPP_CONFIDENCE_THRESHOLD || 80;
      const bestMatch = matches.find(match => match.confidence >= THRESHOLD);

      if (!bestMatch) {
        throw new AppError(
          'No matching face found with sufficient confidence',
          404,
        );
      }

      const person = await Person.findOne({
        where: {
          face_encoding: bestMatch.face_token,
          is_deleted: false,
        },
        include: [
          {
            model: Patient,
            as: 'patient',
          },
          { model: User, as: 'user' },
        ],
        transaction,
      });

      if (!person) {
        throw new AppError('Person not found in database', 404);
      }

      const startOfDay = new Date(currentDateTime);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(currentDateTime);
      endOfDay.setHours(23, 59, 59, 999);

      const patient = person?.patient;

      const recentArrival = await Appointment.findOne({
        where: {
          patient_id: patient.patient_id,
          status: 'arrived',
          updated_at: {
            [Op.gte]: new Date(currentDateTime - 2 * 60 * 1000),
          },
        },
        include: [
          {
            model: Staff,
            as: 'doctor',
            include: [
              {
                model: Person,
                as: 'person',
              },
            ],
          },
        ],
        transaction,
      });

      if (recentArrival) {
        await transaction.commit();
        const arrivalTime = new Date(recentArrival.updated_at);

        return {
          confidence: bestMatch.confidence,
          notificationSent: false,
          alreadyCheckedIn: true,
          patient: {
            name: `${person.first_name} ${person.last_name}`,
            id: person.person_id,
          },
          appointment: {
            id: recentArrival.appointment_id,
            date: recentArrival.appointment_date,
            time: new Date(
              `${recentArrival.appointment_date}T${recentArrival.start_time}`,
            ).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            arrivalTime: arrivalTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            currentTime: currentDateTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            doctor: `Dr. ${recentArrival.doctor.person.first_name} ${recentArrival.doctor.person.last_name}`,
            department: recentArrival.doctor.specialization,
            status: 'arrived',
          },
        };
      }

      const appointments = await Appointment.findAll({
        where: {
          patient_id: patient.patient_id,
          appointment_date: {
            [Op.between]: [startOfDay, endOfDay],
          },
          status: { [Op.in]: ['scheduled', 'confirmed'] },
        },
        include: [
          {
            model: Staff,
            as: 'doctor',
            attributes: ['specialization', 'staff_uuid'],
            include: [
              {
                model: Department,
                as: 'department',
              },
              {
                model: Person,
                as: 'person',
              },
            ],
          },
        ],
        order: [['start_time', 'ASC']],
        transaction,
      });

      if (appointments.length === 0) {
        const arrivedAppointment = await Appointment.findOne({
          where: {
            patient_id: patient.patient_id,
            appointment_date: {
              [Op.between]: [startOfDay, endOfDay],
            },
            status: 'arrived',
          },
          include: [
            {
              model: Staff,
              as: 'doctor',
              include: [
                {
                  model: Person,
                  as: 'person',
                },
              ],
            },
          ],
          transaction,
        });

        if (arrivedAppointment) {
          await transaction.commit();
          const arrivalTime = new Date(arrivedAppointment.updated_at);

          return {
            confidence: bestMatch.confidence,
            notificationSent: false,
            alreadyCheckedIn: true,
            patient: {
              name: `${person.first_name} ${person.last_name}`,
              id: person.person_id,
            },
            appointment: {
              id: arrivedAppointment.appointment_id,
              date: arrivedAppointment.appointment_date,
              time: new Date(
                `${arrivedAppointment.appointment_date}T${arrivedAppointment.start_time}`,
              ).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              arrivalTime: arrivalTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              currentTime: currentDateTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              doctor: `Dr. ${arrivedAppointment.doctor.person.first_name} ${arrivedAppointment.doctor.person.last_name}`,
              department: arrivedAppointment.doctor.specialization,
              status: 'arrived',
            },
          };
        }

        throw new AppError('No appointments scheduled for today', 404, {
          patient: {
            name: `${person.first_name} ${person.last_name}`,
            id: person.person_id,
          },
        });
      }

      const ONE_HOUR_MS = 60 * 60 * 1000;
      const THIRTY_MIN_MS = 30 * 60 * 1000;

      const appointment = appointments[0];

      const appointmentTime = new Date(
        `${appointment.appointment_date}T${appointment.start_time}`,
      );
      const timeDiff = currentDateTime - appointmentTime;
      const doctor = appointment.doctor;

      if (timeDiff < -ONE_HOUR_MS) {
        throw new AppError('Appointment is more than 1 hour away', 400, {
          patient: {
            name: `${person.first_name} ${person.last_name}`,
            id: person.person_id,
          },
          appointment: {
            id: appointment.appointment_id,
            date: appointment.appointment_date,
            time: appointmentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            currentTime: currentDateTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            doctor: `Dr. ${doctor.person.first_name} ${doctor.person.last_name}`,
            department: doctor.specialization,
          },
        });
      }

      if (timeDiff > THIRTY_MIN_MS) {
        await appointment.update(
          {
            status: 'no_show',
            notes: `Auto-marked as no-show at ${currentDateTime.toISOString()}. Patient arrived ${Math.round(timeDiff / 60000)} minutes late.`,
          },
          { transaction },
        );
        await transaction.commit();

        throw new AppError(
          'Appointment window has passed. Status updated to No-Show.',
          400,
          {
            confidence: bestMatch.confidence,
            statusUpdated: true,
            patient: {
              name: `${person.first_name} ${person.last_name}`,
              id: person.person_id,
            },
            appointment: {
              id: appointment.appointment_id,
              date: appointment.appointment_date,
              time: appointmentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              currentTime: currentDateTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              doctor: `Dr. ${doctor.person.first_name} ${doctor.person.last_name}`,
              department: doctor.specialization,
              minutesLate: Math.round(timeDiff / 60000),
            },
          },
        );
      }

      // ✅ Mark as arrived (works for ANY time before the appointment)
      await appointment.update(
        {
          status: 'arrived',
          updated_at: currentDateTime,
          notes: `Arrived via face verification at ${currentDateTime.toISOString()}${
            timeDiff > 0
              ? ` (${Math.round(timeDiff / 60000)} min late)`
              : ` (${Math.abs(Math.round(timeDiff / 60000))} min early)`
          }`,
        },
        { transaction },
      );

      // Update first visit date if needed
      if (!patient.first_visit_date) {
        await patient.update({ first_visit_date: new Date() }, { transaction });
      }

      await transaction.commit();

      let notificationSent = false;

      try {
        const roomName = `doctor-${doctor.staff_uuid}-${doctor.person.last_name}`;

        await broadcastToAll('patient-arrived', {
          userUuid: person?.user?.user_uuid,
          appointmentId: appointment.appointment_id,
          patientName: `${person.first_name} ${person.last_name}`,
          doctorId: appointment.doctor_id,
          arrivalTime: currentDateTime,
          status: 'arrived',
        });

        await emitToRoom(roomName, 'patient-arrived', {
          appointmentId: appointment.appointment_id,
          patientName: `${person.first_name} ${person.last_name}`,
          arrivalTime: currentDateTime,
          appointment_status: 'arrived',
          status: 'arrived',
        });

        notificationSent = true;
      } catch (socketError) {
        console.error('Socket notification failed:', socketError.message);
      }

      return {
        confidence: bestMatch.confidence,
        notificationSent,
        patient: {
          name: `${person.first_name} ${person.last_name}`,
          id: person.person_id,
        },
        appointment: {
          id: appointment.appointment_id,
          date: appointment.appointment_date,
          time: appointmentTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          currentTime: currentDateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          doctor: `Dr. ${doctor.person.first_name} ${doctor.person.last_name}`,
          department: doctor.specialization,
          status: 'arrived',
        },
      };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      console.log('Verify appointment failed: ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Verify appointment failed.', 500);
    }
  }
}

export default new kioskService();
