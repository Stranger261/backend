import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';
import { Op } from 'sequelize';

import AppError from '../../../shared/utils/AppError.util.js';
import {
  Admission,
  AdmissionProgressNote,
  Appointment,
  AppointmentVitals,
  Department,
  Patient,
  Person,
  Prescription,
  PrescriptionItem,
  sequelize,
  Staff,
  User,
  PHIAccessLog,
  MedicalRecord,
  PersonContact,
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
        await broadcastToAll('patient-arrived', {
          userUuid: person?.user?.user_uuid,
          appointmentId: appointment.appointment_id,
          patientName: `${person.first_name} ${person.last_name}`,
          doctorId: appointment.doctor_id,
          arrivalTime: currentDateTime,
          status: 'arrived',
        });
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

  // Add this method to your existing kioskService.js

  /**
   * Get patient medical data via face recognition
   * Uses the SAME logic as your existing MedicalRecordsService
   */
  async getPatientMedicalData(livePhotoBase64, requestInfo = {}) {
    try {
      console.log('🔍 Starting face recognition for medical records...');

      // Step 1: Detect and get face token from live photo (YOUR EXISTING LOGIC)
      const liveDetection = await this.detectAndCropFace(livePhotoBase64);
      const liveFaceToken = liveDetection.faceToken;

      // Step 2: Search for matching face in FaceSet (YOUR EXISTING LOGIC)
      const matches = await this.searchFaceInFaceSet(liveFaceToken);

      if (matches.length === 0) {
        throw new AppError('No registered face found in the system.', 404);
      }

      // Step 3: Check confidence threshold (YOUR EXISTING LOGIC)
      const THRESHOLD = process.env.FACEPP_CONFIDENCE_THRESHOLD || 80;
      const bestMatch = matches.find(match => match.confidence >= THRESHOLD);

      if (!bestMatch) {
        throw new AppError(
          'No matching face found with sufficient confidence',
          404,
        );
      }

      console.log(
        `✅ Face matched with ${bestMatch.confidence.toFixed(2)}% confidence`,
      );

      // Step 4: Get person and patient from database (YOUR EXISTING LOGIC)
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
          {
            model: User,
            as: 'user',
          },
          { model: PersonContact, as: 'contacts' },
        ],
      });

      if (!person || !person.patient) {
        throw new AppError('Patient record not found in database', 404);
      }

      const patient = person.patient;
      const userId = person.user?.user_id;
      const patientId = patient.patient_id;
      const contacts = person.contacts;

      console.log(
        `✅ Patient identified: ${person.first_name} ${person.last_name}`,
      );

      // Step 5: Log PHI access for HIPAA compliance (YOUR EXISTING LOGIC)
      try {
        await PHIAccessLog.logAccess(
          userId,
          null, // No staff ID for patient self-access
          'patient',
          patientId,
          'view_medical_records',
          'comprehensive_medical_records',
          null,
          'Patient accessed own medical records via face recognition',
          requestInfo.ipAddress || null,
          requestInfo.userAgent || null,
          requestInfo.sessionId || null,
          'kiosk_biometric',
        );
        console.log('✅ PHI access logged');
      } catch (logError) {
        console.error('Failed to log PHI access:', logError.message);
        // Don't throw - logging failures shouldn't block operations
      }

      // Step 6: Fetch medical records using the SAME logic as MedicalRecordsService
      const medicalRecords = await this.fetchPatientMedicalRecords(patientId);

      return {
        success: true,
        confidence: bestMatch.confidence,
        patient: {
          patientId: patient.patient_id,
          patientUuid: patient.patient_uuid,
          mrn: patient.mrn,
          patientNumber: patient.patient_number,
          fullName: `${person.first_name}${person.middle_name ? ' ' + person.middle_name : ''} ${person.last_name}`,
          firstName: person.first_name,
          lastName: person.last_name,
          dateOfBirth: person.date_of_birth,
          age: this.calculateAge(person.date_of_birth),
          gender: person.gender,
          bloodType: person.blood_type,
          contactNumber:
            person.contact_number ||
            person.phone ||
            patient.phone ||
            patient.contact ||
            patient.contact_number ||
            contacts.find(c => !c.is_primary).contact_number,
          email: person.email,
          emergencyContact: contacts,
        },
        medicalRecords,
        accessTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get patient medical records:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to retrieve patient medical records.', 500);
    }
  }

  /**
   * Fetch patient medical records using SAME logic as MedicalRecordsService.fetchMedicalRecords
   * This uses the EXACT SAME models and structure
   */
  async fetchPatientMedicalRecords(patientId) {
    try {
      // Use the SAME filter structure as your MedicalRecordsService
      const filters = {
        page: 1,
        limit: 100, // Get more records for comprehensive view
        startDate: null,
        endDate: null,
        recordType: null,
        status: null,
        visitType: null,
        search: null,
      };

      // Build date filter (SAME as your service)
      const dateFilter = {};

      // Build base where clause (SAME as your service)
      const baseWhere = { patient_id: patientId };

      // Fetch all record types concurrently (SAME as your service)
      const [medicalRecords, appointments, admissions] = await Promise.all([
        this.fetchMedicalRecordsData(patientId, filters, dateFilter, baseWhere),
        this.fetchAppointmentsData(patientId, filters, dateFilter, baseWhere),
        this.fetchAdmissionsData(patientId, filters, dateFilter, baseWhere),
      ]);

      // Build unified timeline (SAME as your service)
      const timeline = this.buildMedicalTimeline({
        medicalRecords,
        appointments,
        admissions,
        requestingUserRole: 'patient', // Since it's the patient accessing their own records
      });

      return {
        timeline,
        summary: {
          totalRecords: timeline.length,
          totalMedicalRecords: medicalRecords.length,
          totalAppointments: appointments.length,
          totalAdmissions: admissions.length,
        },
        // Include raw data for easy access
        medicalRecords,
        appointments,
        admissions,
      };
    } catch (error) {
      console.error('Fetch medical records failed:', error.message);
      throw new AppError('Failed to fetch medical records', 500);
    }
  }

  /**
   * Fetch medical records data (COPIED from your MedicalRecordsService)
   */
  async fetchMedicalRecordsData(patientId, filters, dateFilter, baseWhere) {
    const { visitType } = filters;

    const where = { ...baseWhere };

    // Apply date filter
    if (Object.keys(dateFilter).length > 0) {
      where.record_date = dateFilter;
    }

    // Apply visit type filter
    if (visitType && visitType !== '') {
      where.visit_type = visitType;
    }

    return MedicalRecord.findAll({
      where,
      include: [
        {
          model: Staff,
          as: 'doctor',
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
      ],
      order: [['record_date', 'DESC']],
    });
  }

  /**
   * Fetch appointments data (COPIED from your MedicalRecordsService)
   */
  async fetchAppointmentsData(patientId, filters, dateFilter, baseWhere) {
    const { visitType, status } = filters;

    // If visitType is specified and not appointment, return empty
    if (visitType && visitType !== '' && visitType !== 'appointment') {
      return [];
    }

    const where = { ...baseWhere };

    // Apply date filter
    if (Object.keys(dateFilter).length > 0) {
      where.appointment_date = dateFilter;
    }

    // Apply status filter
    if (status && status !== '') {
      where.status = status;
    }

    return Appointment.findAll({
      where,
      include: [
        {
          model: AppointmentVitals,
          as: 'vitals',
          required: false,
        },
        {
          model: Staff,
          as: 'doctor',
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
          as: 'resultingAdmission',
          required: false,
          include: [
            {
              model: AdmissionProgressNote,
              as: 'progressNotes',
              where: { is_deleted: false },
              required: false,
              separate: true,
              limit: 10,
              order: [['note_date', 'DESC']],
              include: [
                {
                  model: Staff,
                  as: 'recorder',
                  include: [
                    {
                      model: Person,
                      as: 'person',
                      attributes: ['first_name', 'middle_name', 'last_name'],
                    },
                  ],
                },
              ],
            },
            {
              model: Prescription,
              as: 'prescriptions',
              required: false,
              include: [
                {
                  model: PrescriptionItem,
                  as: 'items',
                  required: false,
                },
              ],
            },
            {
              model: Staff,
              as: 'attendingDoctor',
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
          ],
        },
      ],
      order: [['appointment_date', 'DESC']],
    });
  }

  /**
   * Fetch admissions data (COPIED from your MedicalRecordsService)
   */
  async fetchAdmissionsData(patientId, filters, dateFilter, baseWhere) {
    const { visitType, status } = filters;

    // If visitType is specified and not admission, return empty
    if (visitType && visitType !== '' && visitType !== 'admission') {
      return [];
    }

    const where = { ...baseWhere };

    // Apply date filter
    if (Object.keys(dateFilter).length > 0) {
      where.admission_date = dateFilter;
    }

    // Apply status filter
    if (status && status !== '') {
      where.admission_status = status;
    }

    return Admission.findAll({
      where,
      include: [
        {
          model: AdmissionProgressNote,
          as: 'progressNotes',
          where: { is_deleted: false },
          required: false,
          separate: true,
          limit: 10,
          order: [['note_date', 'DESC']],
          include: [
            {
              model: Staff,
              as: 'recorder',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: ['first_name', 'middle_name', 'last_name'],
                },
              ],
            },
          ],
        },
        {
          model: Prescription,
          as: 'prescriptions',
          required: false,
          include: [
            {
              model: PrescriptionItem,
              as: 'items',
              required: false,
            },
          ],
        },
        {
          model: Staff,
          as: 'attendingDoctor',
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'middle_name', 'last_name', 'suffix'],
            },
          ],
        },
      ],
      order: [['admission_date', 'DESC']],
    });
  }

  /**
   * Build unified medical timeline (COPIED from your MedicalRecordsService)
   */
  buildMedicalTimeline({
    medicalRecords,
    appointments,
    admissions,
    requestingUserRole = null,
  }) {
    const timeline = [];

    // Add medical records to timeline
    medicalRecords.forEach(record => {
      timeline.push({
        id: `mr-${record.record_id}`,
        type: 'medical_record',
        recordType: record.record_type,
        date: record.record_date,
        title: this.getRecordTitle(record.record_type),
        visitType: record.visit_type,
        visitId: record.visit_id,
        chiefComplaint: record.chief_complaint,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        notes: record.notes,
        doctor: this.formatDoctorName(record.doctor),
        doctorFirstName: record.doctor?.person?.first_name || '',
        doctorLastName: record.doctor?.person?.last_name || '',
      });
    });

    // Add appointments to timeline
    appointments.forEach(appointment => {
      const diagnosisArray = Array.isArray(appointment.diagnosis)
        ? appointment.diagnosis
        : [appointment.diagnosis].filter(Boolean);
      const diagnosisInfo = diagnosisArray[0];
      const vitalsInfo = appointment.vitals;
      const relatedAdmission = appointment.resultingAdmission;

      timeline.push({
        id: `apt-${appointment.appointment_id}`,
        type: 'appointment',
        date: appointment.appointment_date,
        title: 'Appointment',
        status: appointment.status,
        appointmentType: appointment.appointment_type,
        chiefComplaint:
          diagnosisInfo?.chief_complaint || vitalsInfo?.chief_complaint,
        diagnosis: diagnosisInfo?.primary_diagnosis,
        secondaryDiagnoses: diagnosisInfo?.secondary_diagnoses,
        treatmentPlan: diagnosisInfo?.treatment_plan,
        disposition: diagnosisInfo?.disposition,
        doctor: this.formatDoctorName(appointment.doctor),
        doctorFirstName: appointment.doctor?.person?.first_name || '',
        doctorLastName: appointment.doctor?.person?.last_name || '',
        vitals: vitalsInfo
          ? {
              temperature: vitalsInfo.temperature,
              bloodPressure: `${vitalsInfo.blood_pressure_systolic}/${vitalsInfo.blood_pressure_diastolic}`,
              heartRate: vitalsInfo.heart_rate,
              respiratoryRate: vitalsInfo.respiratory_rate,
              oxygenSaturation: vitalsInfo.oxygen_saturation,
              weight: vitalsInfo.weight,
              height: vitalsInfo.height,
              bmi: vitalsInfo.bmi,
              painLevel: vitalsInfo.pain_level,
            }
          : null,
        requiresAdmission: diagnosisInfo?.requires_admission,
        requiresFollowup: diagnosisInfo?.requires_followup,
        followupDate: diagnosisInfo?.followup_date,
        relatedAdmission: relatedAdmission
          ? this.formatAdmissionForTimeline(
              relatedAdmission,
              requestingUserRole,
            )
          : null,
      });
    });

    // Add admissions to timeline
    admissions.forEach(admission => {
      timeline.push({
        id: `adm-${admission.admission_id}`,
        type: 'admission',
        date: admission.admission_date,
        title: 'Hospital Admission',
        admissionNumber: admission.admission_number,
        admissionType: admission.admission_type,
        admissionSource: admission.admission_source,
        status: admission.admission_status,
        diagnosis: admission.diagnosis_at_admission,
        expectedDischargeDate: admission.expected_discharge_date,
        dischargeDate: admission.discharge_date,
        dischargeType: admission.discharge_type,
        dischargeSummary: admission.discharge_summary,
        lengthOfStay: admission.length_of_stay_days,
        doctor: this.formatDoctorName(admission.attendingDoctor),
        doctorFirstName: admission.attendingDoctor?.person?.first_name || '',
        doctorLastName: admission.attendingDoctor?.person?.last_name || '',
        progressNotesCount: admission.progressNotes?.length || 0,
        prescriptionsCount: admission.prescriptions?.length || 0,
        recentProgressNotes: this.formatProgressNotesForRole(
          admission.progressNotes?.slice(0, 3) || [],
          requestingUserRole,
        ),
        hasProgressNotes:
          admission.progressNotes && admission.progressNotes.length > 0,
        hasPrescriptions:
          admission.prescriptions && admission.prescriptions.length > 0,
        prescriptions:
          admission.prescriptions?.map(rx => this.formatPrescription(rx)) || [],
      });
    });

    // Sort by date (most recent first)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return timeline;
  }

  /**
   * Format admission for timeline display (COPIED from your MedicalRecordsService)
   */
  formatAdmissionForTimeline(admission, requestingUserRole) {
    return {
      id: `adm-${admission.admission_id}`,
      admissionNumber: admission.admission_number,
      admissionDate: admission.admission_date,
      admissionType: admission.admission_type,
      admissionSource: admission.admission_source,
      status: admission.admission_status,
      diagnosis: admission.diagnosis_at_admission,
      expectedDischargeDate: admission.expected_discharge_date,
      dischargeDate: admission.discharge_date,
      dischargeType: admission.discharge_type,
      dischargeSummary: admission.discharge_summary,
      lengthOfStay: admission.length_of_stay_days,
      doctor: this.formatDoctorName(admission.attendingDoctor),
      doctorFirstName: admission.attendingDoctor?.person?.first_name || '',
      doctorLastName: admission.attendingDoctor?.person?.last_name || '',
      progressNotesCount: admission.progressNotes?.length || 0,
      recentProgressNotes: this.formatProgressNotesForRole(
        admission.progressNotes?.slice(0, 3) || [],
        requestingUserRole,
      ),
      prescriptions:
        admission.prescriptions?.map(rx => this.formatPrescription(rx)) || [],
    };
  }

  /**
   * Format progress notes (COPIED from your MedicalRecordsService)
   */
  formatProgressNotesForRole(progressNotes, requestingUserRole) {
    return progressNotes.map(note => ({
      noteId: note.note_id,
      noteDate: note.note_date,
      noteType: note.note_type,
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      isCritical: note.is_critical,
      recordedBy: this.formatStaffName(note.recorder),
      recordedByFirstName: note.recorder?.person?.first_name || '',
      recordedByLastName: note.recorder?.person?.last_name || '',
    }));
  }

  /**
   * Format prescription (COPIED from your MedicalRecordsService)
   */
  formatPrescription(prescription) {
    return {
      prescriptionId: prescription.prescription_id,
      prescriptionNumber: prescription.prescription_number,
      prescriptionDate: prescription.prescription_date,
      status: prescription.prescription_status,
      items:
        prescription.items?.map(item => ({
          itemId: item.item_id,
          medicationName: item.medication_name,
          dosage: item.dosage,
          frequency: item.frequency,
          route: item.route,
          duration: item.duration,
          instructions: item.instructions,
          dispensed: item.dispensed,
        })) || [],
    };
  }

  /**
   * Helper: Format doctor name (COPIED from your MedicalRecordsService)
   */
  formatDoctorName(doctor) {
    if (!doctor || !doctor.person) return 'Unknown';

    const { first_name, middle_name, last_name, suffix } = doctor.person;
    let name = `Dr. ${first_name}`;

    if (middle_name) name += ` ${middle_name}`;
    name += ` ${last_name}`;
    if (suffix) name += `, ${suffix}`;

    return name;
  }

  /**
   * Helper: Format staff name (COPIED from your MedicalRecordsService)
   */
  formatStaffName(staff) {
    if (!staff || !staff.person) return 'Unknown';

    const { first_name, middle_name, last_name, suffix } = staff.person;
    let name = first_name;

    if (middle_name) name += ` ${middle_name}`;
    name += ` ${last_name}`;
    if (suffix) name += `, ${suffix}`;

    return name;
  }

  /**
   * Helper: Get record title (COPIED from your MedicalRecordsService)
   */
  getRecordTitle(recordType) {
    const titles = {
      consultation: 'Consultation',
      lab_result: 'Laboratory Result',
      imaging: 'Imaging Study',
      diagnosis: 'Diagnosis',
      procedure: 'Procedure',
    };
    return titles[recordType] || recordType;
  }

  /**
   * Calculate age from date of birth
   */
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;

    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }
}

export default new kioskService();
