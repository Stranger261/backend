import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { Op } from 'sequelize';
import axios from 'axios';

// service util
import { otpGenerator } from '../util/generateOTP.util.js';
import { sendOTPEmail } from '../util/sendOTPEmail.util.js';
import { sanitizeUser } from '../util/sanitizeUser.util.js';
import auditHelper from '../../../shared/utils/logger.util.js';
// shared util
import { patientApi } from '../../../shared/utils/apiUrl.util.js';
import AppError from '../../../shared/utils/AppError.util.js';

import {
  User,
  EmailVerificationToken,
  sequelize,
  Role,
  UserRole,
} from '../../../shared/models/index.js';
import { parseIDFromOCR } from '../util/ocrParser.js';

export default new (class authRegistration {
  async initialRegistration(
    email,
    phone,
    password,
    userAgent,
    ipAddress,
    role = 'Patient'
  ) {
    const transaction = await sequelize.transaction();
    let token = null;
    try {
      const phoneRegex = /^\+639\d{9}$/;
      if (phone && !phoneRegex.test(phone.trim())) {
        throw new AppError(
          'Invalid Philippine phone number format. Must start with +63 followed by 9 and 9 more digits (e.g., +639123456789).',
          400
        );
      }

      const userRole = await Role.findOne({
        where: { role_name: role },
        transaction,
      });

      if (!userRole) {
        throw new AppError('Role not found.', 404);
      }

      const existingActiveUser = await User.findOne({
        where: {
          [Op.or]: [
            { email, is_deleted: false },
            { phone, is_deleted: false },
          ],
        },
        transaction,
      });

      if (existingActiveUser) {
        if (existingActiveUser.email === email) {
          throw new AppError('Email is already used.', 400);
        }

        if (existingActiveUser.phone === phone) {
          throw new AppError('Phone number is already used.', 400);
        }
      }

      const salt = await bcryptjs.genSalt(10);
      const password_hash = await bcryptjs.hash(password, salt);

      const user = await User.create(
        {
          email,
          password_hash,
          phone,
        },
        { transaction }
      );

      if (!user) {
        throw new AppError('Registration failed.', 400);
      }

      await UserRole.create(
        {
          user_id: user.dataValues.user_id,
          role_id: userRole.dataValues.role_id,
          staff_id: null,
          assign_at: new Date(),
        },
        { transaction }
      );

      const currentUserRole = await UserRole.findAll({
        where: {
          user_id: user.user_id,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: new Date() } },
          ],
        },
        include: [
          {
            model: Role,
            as: 'role',
            attributes: ['role_id', 'role_name', 'role_code'],
          },
        ],
        transaction,
      });

      const roles = currentUserRole.map(role => ({
        role_id: role.role.role_id,
        role_name: role.role.role_name,
        role_code: role.role.role_code,
      }));

      if (roles.length === 0) {
        throw new AppError('No active roles assigned to this account.', 403);
      }

      const otpCode = otpGenerator();
      const expiresAt = new Date(
        Date.now() + process.env.OTP_EXPIRY_MINUTES * 60 * 1000
      );

      const isEmailSent = await sendOTPEmail(email, otpCode);
      if (!isEmailSent.success) {
        throw new AppError('Sending email went wrong. Please try again.', 500);
      }

      await EmailVerificationToken.create(
        {
          user_id: user.user_id,
          token: otpCode,
          expires_at: expiresAt,
          ip_address: ipAddress,
        },
        { transaction }
      );
      const sanitizedUser = sanitizeUser(user, roles);

      if (role === 'Patient') {
        token = jwt.sign(
          {
            user_id: user.user_id,
            user_uuid: user.user_uuid,
            email: user.email,
            roles: roles.map(role => role.role_name),
            role: roles[0]?.role_name.toLowerCase(),
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );
      }

      await auditHelper.userRegistration({
        userId: user.user_id,
        userData: user,
        userAgent,
        ipAddress,
        transaction,
      });

      await transaction.commit();

      return {
        reqiuresOtp: true,
        user: sanitizedUser,
        token,
      };
    } catch (error) {
      transaction.rollback();
      console.log('Initial Registration error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error.', 500);
    }
  }

  async OCR(file) {
    if (!file) throw new AppError('No image uploaded', 404);

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
          500
        );
      }

      let result;
      const pollHeaders = { 'Ocp-Apim-Subscription-Key': key };
      for (let i = 0; i < 10; i++) {
        const pollResponse = await axios.get(operationLocation, {
          headers: pollHeaders,
        });
        result = pollResponse.data;
        if (result.status === 'succeeded') break;
        if (result.status === 'failed')
          throw new AppError('Azure OCR failed to process image', 500);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!result || result.status !== 'succeeded') {
        throw new AppError('Timeout waiting for Azure OCR', 500);
      }

      const readResults = result.analyzeResult?.readResults;
      if (!readResults) throw new AppError('No OCR results found.', 500);

      const extractedText = readResults
        .map(page => page.lines.map(line => line.text).join('\n'))
        .join('\n\n'); // Use double newline for text from different pages

      const parsedData = parseIDFromOCR(extractedText);

      return parsedData;
    } catch (error) {
      const azureError = error.response?.data?.message || error.message;

      throw new AppError(`Error calling Azure OCR API: ${azureError}`, 500);
    }
  }

  async verifyEmail(email, otpCode, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findOne({
        where: {
          email,
          registration_status: 'email_verification',
          is_deleted: false,
        },

        transaction,
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      const otpRecord = await EmailVerificationToken.findOne({
        where: {
          user_id: user.user_id,
          token: otpCode,
          verified: false,
          expires_at: { [Op.gt]: new Date() },
        },
        transaction,
        order: [['created_at', 'DESC']],
      });

      if (!otpRecord) {
        throw new AppError('OTP not found or OTP expired already.', 400);
      }

      await Promise.all([
        user.update(
          {
            registration_status: 'personal_info_verification',
            last_activity_at: new Date(),
          },
          { transaction }
        ),
        otpRecord.update(
          { verified: true, verified_at: new Date() },
          { transaction }
        ),
      ]);

      await auditHelper.updateLog({
        userId: user.user_id,
        tableName: 'users',
        oldData: { registration_status: 'email_verification' },
        newData: { registration_status: user.registration_status },
        userAgent,
        ipAddress,
        transaction,
      });

      await transaction.commit();

      return user;
    } catch (error) {
      await transaction.rollback();
      console.log('Verify email error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error.', 500);
    }
  }

  async resendOTP(userUuid, ipAddress) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findOne({
        where: { user_uuid: userUuid },
        transaction,
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      if (user.account_status === 'active' && user.verified_at) {
        throw new AppError('Email already verified.', 400);
      }

      const existingOtp = await EmailVerificationToken.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        transaction,
      });

      if (existingOtp) {
        const now = new Date();
        const lastSent = new Date(existingOtp.created_at);
        const secondsSinceLastSent = Math.floor((now - lastSent) / 1000);

        if (secondsSinceLastSent < process.env.OTP_RESEND_COOLDOWN_SECONDS) {
          throw new AppError(
            `Please wait ${
              process.env.OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSent
            } seconds before requesting a new OTP.`,
            429
          );
        }
      }

      const newOtp = otpGenerator();
      const newExpiry = new Date(
        Date.now() + process.env.OTP_EXPIRY_MINUTES * 60 * 1000
      );

      const isEmailSent = await sendOTPEmail(user.email, newOtp);
      if (!isEmailSent.success) {
        throw new AppError('Failed to send OTP email. Please try again.', 500);
      }

      if (existingOtp) {
        await existingOtp.update(
          {
            token: newOtp,
            expires_at: newExpiry,
            verify: false,
            verfied_at: null,
          },
          { transaction }
        );
      } else {
        await EmailVerificationToken.create(
          {
            user_id: user.user_id,
            token: newOtp,
            expires_at: newExpiry,
            ip_address: ipAddress,
          },
          { transaction }
        );
      }

      await transaction.commit();

      return {
        expiresIn: process.env.OTP_EXPIRY_MINUTES,
      };
    } catch (error) {
      transaction.rollback();

      console.log('Resend OTP error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error.', 500);
    }
  }

  async completeProfileWithID(
    userUUID,
    formData,
    idPhotoBuffer,
    userAgent,
    ipAddress
  ) {
    if (!idPhotoBuffer) {
      throw new AppError('ID photo is required', 400);
    }

    const transaction = await sequelize.transaction();

    try {
      const user = await User.findOne({
        where: {
          user_uuid: userUUID,
          registration_status: 'personal_info_verification',
          is_deleted: false,
        },
        transaction,
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const idPhotoBase64 = idPhotoBuffer.toString('base64');

      const personData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || null,
        suffix: formData.suffix || null,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        blood_type: formData.blood_type || null,
        nationality: formData.nationality || 'Filipino',
      };

      const personContact = {
        contact_type: formData.contact_type || 'mobile',
        contact_number: formData.contact_number,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_number: formData.emergency_contact_number,
        emergency_contact_relationship: formData.emergency_contact_relationship,
      };

      const personAddress = {
        address_type: formData.address_type || 'home',
        street_address: formData.street_address,
        barangay_code: formData.barangay_code,
        city_code: formData.city_code,
        province_code: formData.province_code,
        postal_code: formData.postal_code || null,
        region_code: formData.region_code,
        is_primary: true,
      };

      const personIdentification = {
        id_type: formData.id_type,
        id_type_specification:
          formData.id_type_specification === 'null'
            ? null
            : formData.id_type_specification,
        id_number: formData.id_number,
        id_expiry_date:
          formData.id_expiry_date === 'null' ? null : formData.id_expiry_date,
      };

      const response = await patientApi.post(
        '/person/register',
        {
          userUUID,
          personData,
          personContact,
          personAddress,
          personIdentification,
          idPhotoBase64,
          ipAddress,
          userAgent,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': process.env.INTERNAL_API_KEY,
          },
          timeout: 60000,
        }
      );

      await auditHelper.updateLog({
        userId: user.user_id,
        tableName: 'users',
        recordId: user.user_id,
        oldData: { registration_status: 'personal_info_verification' },
        newData: { registration_status: 'face_verification' },
        ipAddress,
        userAgent,
        transaction,
      });

      await transaction.commit();

      return {
        person: response.data.data.person,
        identification: response.data.data.identification,
        face: response.data.data.face,
        user: response.data.data.user,
        next_step: 'face_verification',
        message:
          'User account status updated and new person created successfully! Please proceed to face verification.',
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
        console.log('⚠️ Transaction rolled back');
      }

      console.error('❌ Profile completion failed:', error.message);

      // ✅ Handle Axios errors from patient service
      if (error.response) {
        // Patient service returned an error response
        const { error: errorName, message, details } = error.response.data;
        const statusCode = error.response.status;

        console.error(`📡 Patient Service Error [${statusCode}]:`, message);

        throw new AppError(
          message || 'Patient service request failed',
          statusCode,
          details
        );
      }

      // ✅ Handle network/timeout errors
      if (error.request) {
        console.error('📡 Patient Service: No response received');
        throw new AppError(
          'Patient service is not responding. Please try again later.',
          503
        );
      }

      // ✅ Re-throw AppError as-is
      throw error instanceof AppError
        ? error
        : new AppError('Profile completion failed', 500);
    }
  }

  async verifyLiveFace(data) {
    const { userUUID, livePhotoBase64, userAgent, ipAddress } = data;

    const transaction = await sequelize.transaction();
    try {
      console.log('🎭 Auth Service: Starting face verification...');

      const user = await User.findOne({
        where: {
          user_uuid: userUUID,
          registration_status: 'face_verification',
          is_deleted: false,
        },
        transaction,
      });

      if (!user) {
        throw new AppError(
          'User not found or face verification not available at this step',
          404
        );
      }

      console.log(
        '📡 Auth Service: Calling Patient Service for verification...'
      );

      const verificationRes = await patientApi.post('/person/verify-face', {
        userUUID,
        livePhotoBase64,
        ipAddress,
        userAgent,
      });

      const { verified, confidence, match_details } = verificationRes.data.data;
      console.log(verified, confidence, match_details);

      if (verified) {
        await user.update(
          {
            registration_status: 'completed',
            account_status: 'active',
            verified_at: new Date(),
          },
          { transaction }
        );

        await auditHelper.updateLog({
          userId: user.user_id,
          tableName: 'users',
          recordId: user.user_id,
          oldData: {
            registration_status: 'face_verification',
            verified_at: null,
          },
          newData: {
            registration_status: 'completed',
            verified_at: new Date(),
          },
          userAgent,
          ipAddress,
          transaction,
        });

        await transaction.commit();
        console.log('✅ Auth Service: Face verification successful');
      } else {
        console.log('❌ Auth Service: Face verification failed');
        throw new AppError(
          'User registered face does not match with live capture.',
          400
        );
      }

      console.log('still got this but the face is not the same');

      return {
        verified,
        confidence,
        match_details,
        registration_completed: verified,
        user,
      };
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Auth Service: Verification failed:', error.message);

      if (error.response?.data) {
        throw new AppError(
          error.response.data.message || 'Verification failed',
          error.response.status || 500,
          error.response.data.details
        );
      }

      if (error.request) {
        throw new AppError(
          'Patient service is not responding. Please try again later.',
          503
        );
      }

      throw error instanceof AppError
        ? error
        : new AppError('Face verification failed', 500);
    }
  }
})();
