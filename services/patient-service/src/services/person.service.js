import path from 'path';
import fs from 'fs/promises';

import { parseIDFromOCR } from '../utils/ocrParser.util.js';
import FaceProcessingService from './faceProcessing.service.js';
import { OCRService } from './ocr.service.js';

// shared modules
import auditHelper from '../../../shared/utils/logger.util.js';
import AppError from '../../../shared/utils/AppError.util.js';
import { activeRecord } from '../../../shared/helpers/queryFilters.helper.js';

import {
  sequelize,
  IdType,
  User,
  Person,
  PersonAddress,
  PersonContact,
  PersonIdentification,
  Patient,
} from '../../../shared/models/index.js';

export default new (class personService {
  constructor() {
    this.ocrService = new OCRService();
    this.faceProcessingService = new FaceProcessingService();
  }

  async OCR(file) {
    if (!file) {
      throw new AppError('File not found.', 404);
    }

    const ocrUrl = `${process.env.AZURE_OCR_ENDPOINT}/vision/v3.2/read/analyze`;
    const key = process.env.AZURE_OCR_KEY;
    const headers = {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/octet-stream',
    };

    try {
      const response = await axios.post(ocrUrl, file.buffer, { headers });
      const operationLocation = response.headers['operation-location'];
      if (!operationLocation) {
        throw new AppError(
          'No operation-location returned from Azure OCR',
          404,
        );
      }

      let result;
      const pollHeaders = { 'Ocp-Apim-Subscription-Key': key };
      for (let i = 0; i < 10; i++) {
        const pollResponse = await axios.get(operationLocation, {
          headers: pollHeaders,
        });
        result = pollResponse;

        if (result.status === 'succeeded') {
          break;
        }
        if (result.status === 'failed') {
          throw new AppError('Azure OCR failed to process image.', 500);
        }

        await new Promise(res => setTimeout(res, 1000));
      }

      if (!result || result.status !== 'succeeded') {
        throw new AppError('Timeout waiting for Azure Ocr.', 500);
      }

      const readResults = result.analyzeResult?.readResultss;
      if (!readResults) {
        throw new AppError('No OCR results found.', 404);
      }

      const extractedText = readResults
        .map(page => page.lines.map(line => line.text).join('\n'))
        .join('\n\n');

      const parsedData = parseIDFromOCR(extractedText);

      return { extractedText, parsedData };
    } catch (error) {
      console.log('OCR Error: ', error);

      throw error instanceof AppError
        ? error
        : new AppError('Internal server error', 500);
    }
  }

  async registerPerson(data) {
    const {
      userUUID,
      personData,
      personContact,
      personAddress,
      personIdentification,
      idPhotoBase64,
      ipAddress,
      userAgent,
    } = data;

    const transaction = await sequelize.transaction();
    let faceTokenToCleanup = null;
    let savedFiles = [];
    let createdPersonId;

    try {
      // PHASE 1: Validations
      const user = await User.findOne({
        where: { user_uuid: userUUID, is_deleted: false },
        transaction,
      });

      if (!user) throw new AppError('User not found', 404);

      console.log(user);
      const existingPerson = await Person.findOne({
        where: { user_id: user.user_id },
        transaction,
      });

      if (existingPerson) {
        throw new AppError('Personal information already submitted', 409);
      }

      const idType = await IdType.findOne({
        where: activeRecord({ id_type_code: personIdentification.id_type }),
        transaction,
      });

      if (!idType) throw new AppError('Invalid ID type', 400);

      const existingId = await PersonIdentification.findOne({
        where: activeRecord({ id_number: personIdentification.id_number }),
        transaction,
      });

      if (existingId) {
        throw new AppError('This ID number is already registered', 409);
      }

      const existingContact = await PersonContact.findOne({
        where: {
          contact_number: personContact.contact_number,
          is_primary: true,
        },
        transaction,
      });

      if (existingContact)
        throw new AppError('This contact number is already registered', 409);

      if (
        personContact.contact_number === personContact.emergency_contact_number
      ) {
        throw new AppError(
          'Emergency contact cannot be same as primary contact',
          400,
        );
      }

      const idPhotoBuffer = Buffer.from(idPhotoBase64, 'base64');

      // PHASE 2: Process face & check duplicates
      const ocrResult = await this.ocrService.extractIDData(idPhotoBuffer);

      const tempFaceData = await this.faceProcessingService.processFaceFromID(
        idPhotoBuffer,
        0,
      );
      faceTokenToCleanup = tempFaceData.face_encoding;

      // ✅ Check duplicates using FaceSet (1 API call!)
      await this.faceProcessingService.checkDuplicateFace(
        tempFaceData.face_encoding,
        transaction,
      );

      // PHASE 3: Create person
      const newPerson = await Person.create(
        {
          user_id: user.user_id,
          first_name: personData.first_name,
          last_name: personData.last_name,
          middle_name: personData.middle_name || null,
          suffix: personData.suffix || null,
          date_of_birth: personData.date_of_birth,
          gender: personData.gender,
          blood_type: personData.blood_type || null,
          nationality: personData.nationality || 'Filipino',
          face_encoding: null,
          face_image_path: null,
          face_quality_score: null,
          face_captured_at: null,
        },
        { transaction },
      );

      createdPersonId = newPerson.person_id;

      // PHASE 4: Save files & add to FaceSet
      const idImagePath = `/uploads/ids/id_${createdPersonId}_${Date.now()}.jpg`;
      const idImageFullPath = path.join(
        process.cwd(),
        idImagePath.substring(1),
      );
      await fs.mkdir(path.dirname(idImageFullPath), { recursive: true });
      await fs.writeFile(idImageFullPath, idPhotoBuffer);
      savedFiles.push(idImageFullPath);

      const faceImageResult = await this.faceProcessingService.saveFaceImage(
        tempFaceData.cropped_face_buffer,
        createdPersonId,
      );
      savedFiles.push(faceImageResult.filepath);

      await this.faceProcessingService.addFaceToFaceSet(
        tempFaceData.face_encoding,
        createdPersonId,
      );

      await newPerson.update(
        {
          face_encoding: tempFaceData.face_encoding,
          face_image_path: faceImageResult.relativePath,
          face_quality_score: tempFaceData.face_quality_score,
          face_captured_at: new Date(),
          face_capture_device: 'id_photo',
        },
        { transaction },
      );

      // PHASE 5: Create related records
      await PersonContact.create(
        {
          person_id: createdPersonId,
          contact_type: 'mobile',
          contact_number: personContact.contact_number,
          is_primary: true,
        },
        { transaction },
      );

      await PersonContact.create(
        {
          person_id: createdPersonId,
          contact_type: 'emergency',
          contact_number: personContact.emergency_contact_number,
          contact_name: personContact.emergency_contact_name,
          relationship: personContact.emergency_contact_relationship,
          is_primary: false,
        },
        { transaction },
      );

      await PersonAddress.create(
        {
          person_id: createdPersonId,
          address_type: personAddress.address_type,
          street_address: personAddress.street_address,
          region_code: personAddress.region_code,
          province_code: personAddress.province_code,
          city_code: personAddress.city_code,
          barangay_code: personAddress.barangay_code,
          postal_code: personAddress.postal_code,
          is_primary: true,
        },
        { transaction },
      );

      await PersonIdentification.create(
        {
          person_id: createdPersonId,
          id_type_id: idType.id_type_id,
          id_number: personIdentification.id_number,
          id_specification: personIdentification.id_type_specification,
          expiry_date: personIdentification.id_expiry_date,
          front_image_path: idImagePath,
          ocr_raw_data: JSON.stringify(ocrResult.raw),
          ocr_confidence_score: ocrResult.confidence,
          ocr_extracted_at: new Date(),
          verification_status:
            ocrResult.confidence >= 80 ? 'verified' : 'verified',
          is_primary: true,
          is_active: true,
        },
        { transaction },
      );

      // Audit log
      await auditHelper.createLog({
        userId: user.user_id,
        tableName: 'person',
        recordId: newPerson.person_id,
        newData: { newPerson },
        userAgent,
        ipAddress,
        transaction,
      });

      await user.update(
        {
          registration_step: 'face_verification',
          registration_status: 'face_verification',
        },
        { transaction },
      );

      await transaction.commit();

      return {
        success: true,
        person: {
          person_id: newPerson.person_id,
          first_name: newPerson.first_name,
          last_name: newPerson.last_name,
          date_of_birth: newPerson.date_of_birth,
        },
        face: {
          quality_score: tempFaceData.face_quality_score,
          added_to_faceset: true,
        },
        user,
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      // ✅ Remove from FaceSet if added
      if (createdPersonId) {
        await this.faceProcessingService.removeFaceFromFaceSet(
          faceTokenToCleanup,
        );
      }

      for (const filepath of savedFiles) {
        try {
          await fs.unlink(filepath);
        } catch (e) {
          console.error('Failed to delete file:', filepath);
        }
      }

      console.error('❌ Patient Service: Registration failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Registration failed', 500);
    }
  }

  async cleanupFiles(personId) {
    try {
      const uploadDir = path.join(process.cwd(), 'uploads', 'faces');
      const files = await fs.readdir(uploadDir);

      for (const file of files) {
        if (file.includes(`person_${personId}_`)) {
          await fs.unlink(path.join(uploadDir, file));
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error.message);
    }
  }

  async registerWalkInPerson(data) {
    const {
      personData,
      personContact,
      personAddress,
      personIdentification,
      faceData, // Optional
      ipAddress,
      userAgent,
      staffId, // Who registered this patient (receptionist)
    } = data;

    const transaction = await sequelize.transaction();
    let faceTokenToCleanup = null;
    let savedFiles = [];
    let createdPersonId;

    try {
      // PHASE 1: Validations (no user check needed)

      // Check for duplicate ID number
      if (personIdentification?.id_number) {
        const existingId = await PersonIdentification.findOne({
          where: activeRecord({ id_number: personIdentification.id_number }),
          transaction,
        });

        if (existingId) {
          throw new AppError('This ID number is already registered', 409);
        }
      }

      // Check for duplicate contact number
      const existingContact = await PersonContact.findOne({
        where: {
          contact_number: personContact.contact_number,
          is_primary: true,
        },
        transaction,
      });

      if (existingContact) {
        throw new AppError('This contact number is already registered', 409);
      }

      // Validate emergency contact is different
      if (
        personContact.contact_number === personContact.emergency_contact_number
      ) {
        throw new AppError(
          'Emergency contact cannot be same as primary contact',
          400,
        );
      }

      // PHASE 2: Process face if provided (optional for walk-in)
      let faceProcessingResult = null;
      if (faceData?.imageBuffer) {
        faceProcessingResult =
          await this.faceProcessingService.processFaceFromCamera(
            faceData.imageBuffer,
          );
        faceTokenToCleanup = faceProcessingResult.face_encoding;

        // Check for duplicate face
        await this.faceProcessingService.checkDuplicateFace(
          faceProcessingResult.face_encoding,
          transaction,
        );
      }

      // PHASE 3: Create person (NO user_id for walk-in)
      const newPerson = await Person.create(
        {
          user_id: null, // ✅ Walk-in patients don't have user accounts
          first_name: personData.first_name,
          last_name: personData.last_name,
          middle_name: personData.middle_name || null,
          suffix: personData.suffix || null,
          date_of_birth: personData.date_of_birth,
          gender: personData.gender,
          gender_specification: personData.gender_specification || null,
          blood_type: personData.blood_type || null,
          nationality: personData.nationality || 'Filipino',
          civil_status: personData.civil_status || null,
          phone: personContact.contact_number || null,
          email: personContact.email || null,
          occupation: personData.occupation || null,
          religion: personData.religion || null,
          face_encoding: null,
          face_image_path: null,
          face_quality_score: null,
          face_captured_at: null,
        },
        { transaction },
      );

      createdPersonId = newPerson.person_id;

      // PHASE 4: Save face data if provided
      if (faceProcessingResult) {
        const faceImageResult = await this.faceProcessingService.saveFaceImage(
          faceProcessingResult.cropped_face_buffer,
          createdPersonId,
        );
        savedFiles.push(faceImageResult.filepath);

        await this.faceProcessingService.addFaceToFaceSet(
          faceProcessingResult.face_encoding,
          createdPersonId,
        );

        await newPerson.update(
          {
            face_encoding: faceProcessingResult.face_encoding,
            face_image_path: faceImageResult.relativePath,
            face_quality_score: faceProcessingResult.face_quality_score,
            face_captured_at: new Date(),
            face_capture_device: 'walk_in_camera',
          },
          { transaction },
        );
      }

      // PHASE 5: Create related records

      // Primary contact
      await PersonContact.create(
        {
          person_id: createdPersonId,
          contact_type: 'mobile',
          contact_number: personContact.contact_number,
          is_primary: true,
        },
        { transaction },
      );

      // Emergency contact
      await PersonContact.create(
        {
          person_id: createdPersonId,
          contact_type: 'emergency',
          contact_number: personContact.emergency_contact_number,
          contact_name: personContact.emergency_contact_name,
          relationship: personContact.emergency_contact_relationship,
          relationship_specification:
            personContact.emergency_contact_relationship_specification || null,
          is_primary: false,
        },
        { transaction },
      );

      // Address
      await PersonAddress.create(
        {
          person_id: createdPersonId,
          address_type: personAddress.address_type || 'home',
          street_address: personAddress.street_address || null,
          house_number: personAddress.house_number || null,
          subdivision_village: personAddress.subdivision_village || null,
          region_code: personAddress.region_code,
          province_code: personAddress.province_code,
          city_code: personAddress.city_code,
          barangay_code: personAddress.barangay_code,
          postal_code: personAddress.postal_code || null,
          is_primary: true,
        },
        { transaction },
      );

      // Identification (optional for walk-in)
      if (personIdentification?.id_number && personIdentification?.id_type) {
        const idType = await IdType.findOne({
          where: activeRecord({ id_type_code: personIdentification.id_type }),
          transaction,
        });

        if (!idType) throw new AppError('Invalid ID type', 400);

        await PersonIdentification.create(
          {
            person_id: createdPersonId,
            id_type_id: idType.id_type_id,
            id_number: personIdentification.id_number,
            id_specification:
              personIdentification.id_type_specification || null,
            expiry_date: personIdentification.id_expiry_date || null,
            verification_status: 'pending', // Can be verified later
            is_primary: true,
            is_active: true,
          },
          { transaction },
        );
      }

      // PHASE 6: Create patient record immediately
      const patient = await Patient.createPatient({
        person_id: createdPersonId,
        registration_type: 'walk_in',
        first_visit_date: new Date(),
        transaction,
      });

      // Audit log (use staff_id instead of user_id)
      await auditHelper.createLog({
        userId: staffId, // Receptionist who registered
        tableName: 'person',
        recordId: newPerson.person_id,
        action: 'walk_in_registration',
        newData: {
          person: newPerson,
          patient: patient,
          registered_by: 'receptionist',
        },
        userAgent,
        ipAddress,
        transaction,
      });

      await transaction.commit();

      return {
        success: true,
        person: {
          person_id: newPerson.person_id,
          first_name: newPerson.first_name,
          last_name: newPerson.last_name,
          middle_name: newPerson.middle_name,
          date_of_birth: newPerson.date_of_birth,
        },
        patient: {
          patient_id: patient.patient_id,
          mrn: patient.mrn,
          registration_type: patient.registration_type,
          patient_status: patient.patient_status,
        },
        face: faceProcessingResult
          ? {
              quality_score: faceProcessingResult.face_quality_score,
              added_to_faceset: true,
            }
          : null,
        message: 'Walk-in patient registered successfully',
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      // Remove from FaceSet if added
      if (createdPersonId && faceTokenToCleanup) {
        await this.faceProcessingService.removeFaceFromFaceSet(
          faceTokenToCleanup,
        );
      }

      // Delete saved files
      for (const filepath of savedFiles) {
        try {
          await fs.unlink(filepath);
        } catch (e) {
          console.error('Failed to delete file:', filepath);
        }
      }

      console.error('❌ Walk-in Registration failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Walk-in registration failed', 500);
    }
  }

  async verifyPersonFace(data) {
    const { userUUID, livePhotoBase64, ipAddress, userAgent } = data;
    try {
      const user = await User.findOne({
        where: { user_uuid: userUUID, is_deleted: false },
        include: [
          {
            model: Person,
            as: 'person',
            required: true,
            where: { is_deleted: false },
          },
        ],
      });

      if (!user || !user.person) {
        throw new AppError('User or person not found.', 404);
      }

      const person = user.person;

      if (!person.face_encoding) {
        throw new AppError(
          'No registered face found. Please complete registration first.',
          400,
        );
      }

      let base64Data = livePhotoBase64;

      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      if (!base64Data || base64Data.length === 0) {
        throw new AppError('Invalid image data', 400);
      }

      const livePhotoBuffer = Buffer.from(base64Data, 'base64');
      const liveFaceData =
        await this.faceProcessingService.detectAndCropFace(livePhotoBuffer);

      if (
        !liveFaceData.faceToken ||
        typeof liveFaceData.faceToken !== 'string'
      ) {
        throw new AppError('Failed to extract face token from live photo', 400);
      }

      const comparisonRes = await this.faceProcessingService.compareFaces(
        person.face_encoding,
        liveFaceData.faceToken,
      );

      const VERIFICATION_THRESHOLD =
        parseInt(process.env.FACEPP_VERIFICATION_THRESHOLD) || 80;
      const verified = comparisonRes.confidence >= VERIFICATION_THRESHOLD;

      return {
        verified,
        confidence: comparisonRes.confidence,
        match_details: {
          threshold: VERIFICATION_THRESHOLD,
          enrolled_quality: person.face_quality_score,
          live_quality: liveFaceData.faceQuality,
          reason: verified
            ? 'Face matches registered photo'
            : `Confidence ${comparisonRes.confidence.toFixed(
                1,
              )}% is below threshold ${VERIFICATION_THRESHOLD}%`,
        },
      };
    } catch (error) {
      console.error('Patient Service: Verification failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Face verification failed', 500);
    }
  }

  async getPerson(userUUID) {
    try {
      const user = await User.findOne({
        where: { user_uuid: userUUID },
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }
      const person = await Person.findOne({
        where: { user_id: user.user_id, is_deleted: false },
      });

      if (!person) {
        throw new AppError('Person not found.', 404);
      }

      return person;
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError('Face verification failed', 500);
    }
  }
})();
