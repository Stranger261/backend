import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import bcryptjs from 'bcryptjs';

import sequelize from '../../../shared/config/db.config.js';
import THRESHOLD from '../config/redisThreshold.config.js';
// service util
import { getVal, incrWithTTL } from '../util/rateLimiter.util.js';
import { otpGenerator } from '../util/generateOTP.util.js';
import { sendOTPEmail } from '../util/sendOTPEmail.util.js';
import { sanitizeUser } from '../util/sanitizeUser.util.js';
import { detectDeviceType } from '../util/detectDeviceType.js';
// shared util
import AppError from '../../../shared/utils/AppError.util.js';
import { activeRecord } from '../../../shared/helpers/queryFilters.helper.js';
import { patientApi } from '../../../shared/utils/apiUrl.util.js';
import {
  AccountLockout,
  EmailVerificationToken,
  Patient,
  Person,
  PersonAddress,
  PersonContact,
  Role,
  Staff,
  User,
  UserRole,
  UserSession,
  TrustedDevice,
  TwoFactorAuth,
} from '../../../shared/models/index.js';
import { generateDeviceFingerprint } from '../util/generateDeviceFingerprint.util.js';

export default new (class authService {
  // constructor() {}
  async login(email, password, userAgent, ipAddress, rememberMe) {
    const transaction = await sequelize.transaction();
    try {
      const hashedEmail = crypto
        .createHash('sha256')
        .update(email.toLowerCase())
        .digest('hex');

      const ipKey = `failed:${ipAddress}`;
      const emailKey = `failed:${hashedEmail}`;

      const ipCount = await getVal(ipKey);
      const emailCount = await getVal(emailKey);

      if (
        ipCount >= THRESHOLD.IP_THRESHOLD ||
        emailCount >= THRESHOLD.EMAIL_THRESHOLD
      ) {
        // await (logSusp)

        throw new AppError(
          'Too many requests from your IP. Try again later',
          429,
        );
      }

      const user = await User.findOne(
        {
          where: { email, is_deleted: false },
          include: [
            {
              model: Person,
              as: 'person',
              include: [
                {
                  model: Staff,
                  as: 'staff',
                  attributes: [
                    'staff_id',
                    'staff_uuid',
                    'role',
                    'specialization',
                  ],
                },
                { model: Patient, as: 'patient' },
              ],
            },
          ],
        },
        { transaction },
      );

      if (!user) {
        // Increment failed attempts
        await incrWithTTL(ipKey, THRESHOLD.IP_TTL);
        await incrWithTTL(emailKey, THRESHOLD.EMAIL_TTL);

        throw new AppError('Invalid email or password.', 401);
      }

      const activeLockout = await AccountLockout.findOne({
        where: {
          user_id: user.user_id,
          locked_until: { [Op.gt]: new Date() },
          unlocked_at: null,
        },
        transaction,
      });

      if (activeLockout) {
        const lockedUntil = new Date(activeLockout.locked_until);
        throw new AppError(
          `Account locked until ${lockedUntil.toLocaleString()}. Reason: ${activeLockout.lock_reason}`,
          403,
        );
      }
      // Check account status
      if (user.account_status === 'suspended') {
        throw new AppError(
          'Your account has been suspended. Please contact support.',
          403,
        );
      }

      if (user.account_status === 'inactive') {
        throw new AppError(
          'Your account is inactive. Please contact support.',
          403,
        );
      }

      const isMatch = await bcryptjs.compare(password, user.password_hash);

      if (!isMatch) {
        // Use a SEPARATE transaction for lockout tracking so it persists even when login fails
        const lockoutTransaction = await sequelize.transaction();

        try {
          let lockoutRecord = await AccountLockout.findOne({
            where: {
              user_id: user.user_id,
              email: user.email,
              unlocked_at: null,
            },
            order: [['created_at', 'DESC']],
            transaction: lockoutTransaction,
          });

          if (!lockoutRecord) {
            lockoutRecord = await AccountLockout.create(
              {
                user_id: user.user_id,
                email: user.email,
                ip_address: ipAddress,
                failed_attempts: 1,
                lock_reason: 'failed_login',
              },
              { transaction: lockoutTransaction },
            );
          } else {
            lockoutRecord.failed_attempts += 1;
            lockoutRecord.ip_address = ipAddress;
            lockoutRecord.updated_at = new Date(); // Ensure timestamp updates
          }

          const maxAttempts = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;
          if (lockoutRecord.failed_attempts >= maxAttempts) {
            const lockDuration =
              parseInt(process.env.LOCK_DURATION_MINUTES) || 30;

            lockoutRecord.locked_until = new Date(
              Date.now() + lockDuration * 60 * 1000,
            );
            lockoutRecord.locked_at = new Date();
          }

          await lockoutRecord.save({ transaction: lockoutTransaction });
          await lockoutTransaction.commit();
        } catch (lockoutError) {
          await lockoutTransaction.rollback();
          console.error('Failed to track login attempt:', lockoutError);
        }

        // Now rollback the main transaction
        await transaction.rollback();

        // Increment rate limiting
        try {
          await incrWithTTL(ipKey, THRESHOLD.IP_TTL);
          await incrWithTTL(emailKey, THRESHOLD.EMAIL_TTL);
        } catch (error) {
          console.error('Redis error: ', error.message);
        }

        throw new AppError('Incorrect password.', 400);
      }

      await AccountLockout.update(
        {
          failed_attempts: 0,
          unlocked_at: new Date(),
        },
        {
          where: {
            user_id: user.user_id,
            unlocked_at: null,
          },
          transaction,
        },
      );

      const userRoles = await UserRole.findAll({
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

      const roles = userRoles.map(role => ({
        role_id: role.role.role_id,
        role_name: role.role.role_name,
        role_code: role.role.role_code,
      }));

      // Check if user has any active roles
      if (roles.length === 0) {
        throw new AppError('No active roles assigned to this account.', 403);
      }

      // check if 2fa is enabled
      const is2FAEnabled = user.mfa_enabled && user.mfa_method !== 'disabled';
      const deviceFingerprint = generateDeviceFingerprint(userAgent, ipAddress);

      let isTrustedDevice = false;

      if (is2FAEnabled) {
        const trustedDevice = await TrustedDevice.findOne({
          where: {
            user_id: user.user_id,
            device_fingerprint: deviceFingerprint,
            is_active: true,
            expires_at: { [Op.gt]: new Date() },
          },
          transaction,
        });

        if (trustedDevice) {
          isTrustedDevice = true;
          // Update last used time
          trustedDevice.last_used_at = new Date();
          await trustedDevice.save({ transaction });
        }
      }

      if (is2FAEnabled && !isTrustedDevice) {
        const otpCode = otpGenerator();
        const expiresAt = new Date(
          Date.now() +
            (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000,
        );

        let isOTPSent = false;
        if (user.mfa_method === 'email') {
          const emailResult = await sendOTPEmail(user.email, otpCode);
          isOTPSent = emailResult.success;
        } else if (user.mfa_method === 'sms') {
          // TODO: Implement SMS sending
          // const smsResult = await sendOTPSMS(user.phone, otpCode);
          // isOTPSent = smsResult.success;
          throw new AppError('SMS 2FA is not yet implemented.', 501);
        } else if (user.mfa_method === 'totp') {
          // TODO: Implement TOTP verification
          throw new AppError('TOTP 2FA is not yet implemented.', 501);
        }

        if (!isOTPSent) {
          throw new AppError('Failed to send 2FA code. Please try again.', 500);
        }

        await EmailVerificationToken.create(
          {
            user_id: user.user_id,
            token: otpCode,
            purpose: 'login_2fa',
            expires_at: expiresAt,
            ip_address: ipAddress,
          },
          { transaction },
        );

        await transaction.commit();

        return {
          requiresOtp: true,
          email,
          deviceFingerprint,
          mfaMethod: user.mfa_method,
          message: `2FA code sent to your ${user.mfa_method}.`,
        };
      }

      user.last_activity_at = new Date();
      if (!user.verified_at) {
        user.verified_at = new Date();
      }

      let rememberToken = null;
      if (rememberMe) {
        rememberToken = crypto.randomBytes(64).toString('hex');
        const rememberTokenHash = crypto
          .createHash('sha256')
          .update(rememberToken)
          .digest('hex');

        user.remember_token_hash = rememberTokenHash;
        user.remember_token_expires_at = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        );
      }

      user.last_activity_at = new Date();
      await user.save({ transaction });

      const jwtExpiry = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN;

      const token = jwt.sign(
        {
          user_id: user.user_id,
          user_uuid: user.user_uuid,
          staff_id: user?.person?.staff?.staff_id || null,
          staff_uuid: user?.person?.staff?.staff_uuid || null,
          patient_uuid: user?.person?.patient?.patient_uuid || null,
          email: user.email,
          roles: roles.map(role => role.role_name),
          role: roles[0]?.role_name.toLowerCase(),
        },
        process.env.JWT_SECRET,
        { expiresIn: jwtExpiry },
      );

      // Create session record
      await UserSession.create(
        {
          session_id: crypto.randomUUID(),
          user_id: user.user_id,
          token_hash: crypto.createHash('sha256').update(token).digest('hex'),
          ip_address: ipAddress,
          user_agent: userAgent,
          device_type: detectDeviceType(userAgent),
          last_activity: new Date(),
          expires_at: new Date(
            Date.now() +
              (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000),
          ),
          revoked: false,
        },
        { transaction },
      );

      await transaction.commit();

      const sanitizedUser = sanitizeUser(user, roles);

      // await logAudit()

      return { token, user: sanitizedUser, rememberToken, requiresOtp: false };
    } catch (error) {
      console.log('Login failed: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error.', 500);
    }
  }

  async verifyOTPAndLogin(
    email,
    otpCode,
    userAgent,
    ipAddress,
    trustDevice = false,
    rememberMe = false,
    deviceFingerprint,
  ) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findOne({
        where: { email, is_deleted: false },
        include: [
          {
            model: Person,
            as: 'person',
            include: [
              {
                model: Staff,
                as: 'staff',
                attributes: [
                  'staff_id',
                  'staff_uuid',
                  'role',
                  'specialization',
                ],
              },
              { model: Patient, as: 'patient' },
            ],
          },
        ],
        transaction,
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      const otpRecord = await EmailVerificationToken.findOne({
        where: {
          user_id: user.user_id,
          token: otpCode,
          purpose: 'login_2fa',
          expires_at: { [Op.gt]: new Date() },
          verified: false,
        },
        order: [['created_at', 'DESC']],
        transaction,
      });

      if (!otpRecord) {
        throw new AppError('Invalid or expired OTP code.', 400);
      }

      if (user.account_status === 'suspended') {
        throw new AppError('Your account has been suspended.', 403);
      }

      if (user.account_status === 'inactive') {
        throw new AppError('Your account is inactive.', 403);
      }

      const userRoles = await UserRole.findAll({
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

      const roles = userRoles.map(role => ({
        role_id: role.role.role_id,
        role_name: role.role.role_name,
        role_code: role.role.role_code,
      }));

      if (roles.length === 0) {
        throw new AppError('No active roles assigned to this account.', 403);
      }

      // Trust the device if requested
      if (trustDevice && deviceFingerprint) {
        const trustedUntil = new Date();
        trustedUntil.setDate(trustedUntil.getDate() + 7);

        await TrustedDevice.upsert(
          {
            user_id: user.user_id,
            device_fingerprint: deviceFingerprint,
            device_name: detectDeviceType(userAgent),
            device_type: detectDeviceType(userAgent),
            ip_address: ipAddress,
            user_agent: userAgent,
            trusted_at: new Date(),
            expires_at: trustedUntil,
            last_used_at: new Date(),
            is_active: true,
          },
          { transaction },
        );
      }

      await AccountLockout.update(
        {
          failed_attempts: 0,
          unlocked_at: new Date(),
        },
        {
          where: {
            user_id: user.user_id,
            unlocked_at: null,
          },
          transaction,
        },
      );

      user.last_activity_at = new Date();
      if (!user.verified_at) {
        user.verified_at = new Date();
      }

      let rememberToken = null;
      if (rememberMe) {
        rememberToken = crypto.randomBytes(64).toString('hex');
        const rememberTokenHash = crypto
          .createHash('sha256')
          .update(rememberToken)
          .digest('hex');

        user.remember_token_hash = rememberTokenHash;
        user.remember_token_expires_at = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        );
      }

      await user.save({ transaction });

      await otpRecord.update(
        {
          verify: true,
          verified_at: new Date(),
        },
        { transaction },
      );

      const jwtExpiry = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN || '2h';

      const token = jwt.sign(
        {
          user_id: user.user_id,
          user_uuid: user.user_uuid,
          staff_id: user?.person?.staff?.staff_id || null,
          staff_uuid: user?.person?.staff?.staff_uuid || null,
          patient_uuid: user?.person?.patient?.patient_uuid || null,
          email: user.email,
          roles: roles.map(role => role.role_name),
          role: roles[0]?.role_name.toLowerCase(),
        },
        process.env.JWT_SECRET,
        { expiresIn: jwtExpiry },
      );

      await UserSession.create(
        {
          session_id: crypto.randomUUID(),
          user_id: user.user_id,
          token_hash: crypto.createHash('sha256').update(token).digest('hex'),
          ip_address: ipAddress,
          user_agent: userAgent,
          device_type: detectDeviceType(userAgent),
          last_activity: new Date(),
          expires_at: new Date(
            Date.now() +
              (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000),
          ),
          revoked: false,
        },
        { transaction },
      );

      await transaction.commit();

      const sanitizedUser = sanitizeUser(user, roles);

      return {
        token,
        user: sanitizedUser,
        rememberToken,
      };
    } catch (error) {
      await transaction.rollback();
      console.log('OTP verification failed: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error.', 500);
    }
  }
  async loginWithRememberToken(rememberToken, userAgent, ipAddress) {
    try {
      const tokenHash = crypto
        .createHash('sha256')
        .update(rememberToken)
        .digest('hex');

      const user = await User.findOne({
        where: {
          remember_token_hash: tokenHash,
          remember_token_expires_at: { [Op.gt]: new Date() },
          is_deleted: false,
        },
        include: [
          {
            model: Person,
            as: 'person',
            include: [
              {
                model: Staff,
                as: 'staff',
                attributes: [
                  'staff_id',
                  'staff_uuid',
                  'role',
                  'specialization',
                ],
              },
              { model: Patient, as: 'patient' },
            ],
          },
        ],
      });

      if (!user) {
        throw new AppError('Invalid or expired remember token.', 401);
      }

      if (user.account_status === 'suspended') {
        throw new AppError('Your account has been suspended.', 403);
      }

      if (user.account_status === 'inactive') {
        throw new AppError('Your account is inactive.', 403);
      }

      const activeLockout = await AccountLockout.findOne({
        where: {
          user_id: user.user_id,
          locked_until: { [Op.gt]: new Date() },
          unlocked_at: null,
        },
      });

      if (activeLockout) {
        throw new AppError(
          `Account is locked until ${activeLockout.locked_until.toISOString()}`,
          403,
        );
      }

      const userRoles = await UserRole.findAll({
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
      });

      const roles = userRoles.map(role => ({
        role_id: role.role.role_id,
        role_name: role.role.role_name,
        role_code: role.role.role_code,
      }));

      if (roles.length === 0) {
        throw new AppError('No active roles assigned to this account.', 403);
      }

      user.last_activity_at = new Date();
      await user.save();

      const token = jwt.sign(
        {
          user_id: user.user_id,
          user_uuid: user.user_uuid,
          staff_id: user?.person?.staff?.staff_id || null,
          staff_uuid: user?.person?.staff?.staff_uuid || null,
          patient_uuid: user?.person?.patient?.patient_uuid || null,
          email: user.email,
          roles: roles.map(role => role.role_name),
          role: roles[0]?.role_name.toLowerCase(),
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' },
      );

      await UserSession.create({
        session_id: crypto.randomUUID(),
        user_id: user.user_id,
        token_hash: crypto.createHash('sha256').update(token).digest('hex'),
        ip_address: ipAddress,
        user_agent: userAgent,
        device_type: detectDeviceType(userAgent),
        last_activity: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revoked: false,
      });

      const sanitizedUser = sanitizeUser(user, roles);
      return { token, user: sanitizedUser };
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError('Auto-login failed.', 500);
    }
  }

  async resendLoginOTP(email, ipAddress) {
    try {
      const user = await User.findOne({
        where: { email, is_deleted: false },
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      // Check for existing OTP
      const existingOtp = await EmailVerificationToken.findOne({
        where: {
          user_id: user.user_id,
          purpose: 'login_2fa', // Only check 2FA OTPs
        },
        order: [['created_at', 'DESC']],
      });

      if (existingOtp) {
        const now = new Date();
        const lastSent = new Date(existingOtp.created_at);
        const secondsSinceLastSent = Math.floor((now - lastSent) / 1000);
        const cooldownSeconds =
          parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60;

        if (secondsSinceLastSent < cooldownSeconds) {
          throw new AppError(
            `Please wait ${cooldownSeconds - secondsSinceLastSent} seconds before requesting a new OTP.`,
            429,
          );
        }
      }

      // Generate new OTP
      const newOtp = otpGenerator();
      const newExpiry = new Date(
        Date.now() +
          (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000,
      );

      // Send OTP based on user's 2FA method
      let isOTPSent = false;
      if (user.mfa_method === 'email') {
        const emailResult = await sendOTPEmail(email, newOtp);
        isOTPSent = emailResult.success;
      } else if (user.mfa_method === 'sms') {
        throw new AppError('SMS 2FA is not yet implemented.', 501);
      } else if (user.mfa_method === 'totp') {
        throw new AppError('TOTP 2FA does not require resend.', 400);
      }

      if (!isOTPSent) {
        throw new AppError('Failed to send OTP. Please try again.', 500);
      }

      // Update existing or create new OTP
      if (existingOtp) {
        await existingOtp.update({
          token: newOtp,
          expires_at: newExpiry,
          verify: false,
          verified_at: null,
          ip_address: ipAddress,
        });
      } else {
        await EmailVerificationToken.create({
          user_id: user.user_id,
          token: newOtp,
          purpose: 'login_2fa',
          expires_at: newExpiry,
          ip_address: ipAddress,
        });
      }

      return {
        message: 'OTP sent successfully.',
        expiresIn: parseInt(process.env.OTP_EXPIRY_MINUTES) || 10,
      };
    } catch (error) {
      console.log('Resend login OTP error: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error.', 500);
    }
  }

  async enable2FA(userId, method = 'email') {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findByPk(userId, { transaction });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      // Validate method
      if (!['email', 'sms', 'totp'].includes(method)) {
        throw new AppError('Invalid 2FA method.', 400);
      }

      // Enable 2FA in user table
      user.mfa_enabled = true;
      user.mfa_method = method;
      await user.save({ transaction });

      // Create or update 2FA record
      await TwoFactorAuth.upsert(
        {
          user_id: userId,
          method: method,
          enabled: true,
          enabled_at: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      return {
        message: `2FA enabled successfully with ${method} method.`,
        method: method,
      };
    } catch (error) {
      await transaction.rollback();
      throw error instanceof AppError
        ? error
        : new AppError('Failed to enable 2FA.', 500);
    }
  }

  async disable2FA(userId) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findByPk(userId, { transaction });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      // Disable 2FA
      user.mfa_enabled = false;
      user.mfa_method = 'disabled';
      await user.save({ transaction });

      // Update 2FA record
      await TwoFactorAuth.update(
        {
          enabled: false,
          method: 'disabled',
        },
        {
          where: { user_id: userId },
          transaction,
        },
      );

      // Remove all trusted devices
      await TrustedDevice.update(
        { is_active: false },
        {
          where: { user_id: userId },
          transaction,
        },
      );

      await transaction.commit();

      return {
        message: '2FA disabled successfully. All trusted devices removed.',
      };
    } catch (error) {
      await transaction.rollback();
      throw error instanceof AppError
        ? error
        : new AppError('Failed to disable 2FA.', 500);
    }
  }

  async get2FAStatus(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['user_id', 'mfa_enabled', 'mfa_method'],
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      // Get 2FA record if exists
      const twoFactorAuth = await TwoFactorAuth.findOne({
        where: { user_id: userId },
        attributes: ['method', 'enabled', 'enabled_at'],
      });

      return {
        enabled: user.mfa_enabled || false,
        method: user.mfa_method || 'disabled',
        enabledAt: twoFactorAuth?.enabled_at || null,
      };
    } catch (error) {
      console.log(error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get 2FA status.', 500);
    }
  }

  async getTrustedDevices(userId) {
    try {
      const devices = await TrustedDevice.findAll({
        where: {
          user_id: userId,
          is_active: true,
          expires_at: { [Op.gt]: new Date() },
        },
        order: [['last_used_at', 'DESC']],
        attributes: [
          'device_id',
          'device_name',
          'device_type',
          'ip_address',
          'trusted_at',
          'expires_at',
          'last_used_at',
        ],
      });

      return devices;
    } catch (error) {
      throw new AppError('Failed to get trusted devices.', 500);
    }
  }

  async revokeTrustedDevice(userId, deviceId) {
    try {
      const device = await TrustedDevice.findOne({
        where: {
          device_id: deviceId,
          user_id: userId,
        },
      });

      if (!device) {
        throw new AppError('Device not found.', 404);
      }

      device.is_active = false;
      await device.save();

      return {
        message: 'Device trust revoked successfully.',
      };
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError('Failed to revoke device trust.', 500);
    }
  }

  async getAllUser(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      gender,
      status,
      sortField = 'created_at',
      sortOrder = 'DESC',
      role,
      province,
      city,
      region,
    } = filters;

    const offset = (page - 1) * limit;

    const where = {
      is_deleted: false,
    };

    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { mrn: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (gender) {
      where.gender = gender;
    }

    if (status) {
      where.is_active = status === 'active';
    }

    if (role) {
      where.role = role;
    }

    if (region) {
      where.region = region;
    }

    if (province) {
      where.province = province;
    }

    if (city) {
      where.city = city;
    }
    try {
      const { rows: users, count: total } = await User.findAndCountAll({
        where: { ...where, is_deleted: false },
        limit: Number(limit),
        offset,
        order: [[sortField, sortOrder]],
        attributes: {
          exclude: ['hash_password'],
        },
      });

      return {
        page: Number(page),
        offset: Number(offset),
        total,
        totalPages: Math.ceil(total / limit),
        users,
      };
    } catch (error) {
      console.log('Get all user error: ', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async getUserById(userUuid) {
    try {
      const user = User.find({
        where: { user_uuid: userUuid },
      });

      if (!user) {
        throw new AppError('User not found or deleted/inactive.', 404);
      }

      return user;
    } catch (error) {
      console.log('Get user by ID error: ', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async activateAndInactivateUser(userUuid, status, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.update(
        { where: activeRecord({ user_uuid: userUuid, status }) },
        { transaction },
      );

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      await transaction.commit();
      return user;
    } catch (error) {
      await transaction.rollback();
      console.log('Updating user status failed: ', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async updateUser(userUuid, newData, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();
    try {
      const updatedUser = User.update(newData, {
        where: { user_uuid: userUuid },
        transaction,
      });

      if (!updatedUser) {
        throw new AppError('User not found.', 404);
      }

      await transaction.commit();

      return updatedUser;
    } catch (error) {
      await transaction.rollback();
      console.log('Updating user error: ', error);
      throw (error instanceof AppError ? AppError : 'User update failed.', 500);
    }
  }

  async deleteUser(userUuid, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();

    try {
      const deletedUser = await User.update(
        { is_deleted: true, is_active: false },
        {
          where: activeRecord({ user_uuid: userUuid }),
        },
        transaction,
      );

      if (!deletedUser) {
        throw new AppError('User deletion failed.', 400);
      }

      await transaction.commit();

      return deletedUser;
    } catch (error) {
      await transaction.rollback();
      console.log('Deleting user failed: ', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  async getProfile(userUuid) {
    try {
      const user = await User.findOne({
        where: { user_uuid: userUuid },
        include: [
          {
            model: Person,
            as: 'person',
            include: [
              {
                model: Patient,
                as: 'patient',
              },
              {
                model: Staff,
                as: 'staff',
                attributes: [
                  'staff_id',
                  'staff_uuid',
                  'role',
                  'specialization',
                ],
              },
              { model: PersonAddress, as: 'addresses' },
              { model: PersonContact, as: 'contacts' },
            ],
          },
        ],
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      const userRoles = await UserRole.findAll({
        where: { user_id: user.user_id },
        [Op.or]: [{ expires_at: null, expires_at: { [Op.gt]: new Date() } }],
        include: [
          {
            model: Role,
            as: 'role',
            attributes: ['role_id', 'role_name', 'role_code'],
          },
        ],
      });

      const roles = userRoles.map(userRole => ({
        role_id: userRole.role.role_id, // ✅ userRole.role (not just role)
        role_name: userRole.role.role_name, // ✅ Access from included model
        role_code: userRole.role.role_code, // ✅ Access from included model
      }));

      let personData = null;

      if (user.role === 'patient' && user.registration_status === 'completed') {
        try {
          const patientRes = await patientApi.get(
            `/person/external/user/${user.user_uuid}`,
          );
          console.log(patientRes);

          personData = patientRes.data.data;
        } catch (error) {
          console.log('Fetching patient data error: ', error);
          throw error;
        }
      }

      const sanitizedUser = sanitizeUser(user, roles);
      return {
        user: { ...sanitizedUser, person: user.person },
        person: personData,
      };
    } catch (error) {
      console.log('Get profile error: ', error);
      throw (
        error instanceof AppError ? AppError : 'Internal server error.',
        500
      );
    }
  }

  // for archives/deleted
  async getAllArchivedUser(filters = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      gender,
      role,
      province,
      city,
      region,
      barangay,
      sortField = 'created_at',
      sortOrder = 'DESC',
    } = filters;

    const offset = (page - 1) * limit;

    const where = { is_deleted: true, is_active: false };

    if (gender) {
      where.gender = gender;
    }

    if (role) {
      where.role = role;
    }

    if (province) {
      where.province = province;
    }

    if (city) {
      where.city = city;
    }

    if (region) {
      where.region = region;
    }

    if (barangay) {
      where.barangay = barangay;
    }

    const { rows: allArchivedUsers, count: total } = User.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [[sortField, sortOrder]],
      attributes: {
        exclude: ['hash_password'],
      },
    });

    return {
      page: Number(page),
      offset: Number(offset),
      total,
      totalPages: Math.ceil(total / limit),
      allArchivedUsers,
    };
  }

  async logout(token, cookies) {
    try {
      const operations = [];

      // 1. Revoke JWT session if token exists and is valid
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

          const sessionUpdate = await UserSession.update(
            {
              revoked: true,
              revoked_at: new Date(),
              device_name: 'Logged Out',
            },
            {
              where: {
                token_hash: tokenHash,
                revoked: false,
              },
            },
          );

          operations.push({
            type: 'session_revoked',
            details: `Sessions revoked: ${sessionUpdate[0]}`,
            user_id: decoded.user_id,
          });
        } catch (jwtError) {
          // Invalid/expired token, still proceed with other cleanup
          operations.push({
            type: 'invalid_token',
            details: 'Token was invalid or expired',
          });
        }
      }

      // 2. Clear remember token from user if present in cookies
      const rememberToken = cookies?.remember_token;
      if (rememberToken) {
        const rememberTokenHash = crypto
          .createHash('sha256')
          .update(rememberToken)
          .digest('hex');

        const userUpdate = await User.update(
          {
            remember_token_hash: null,
            remember_token_expires_at: null,
            last_activity_at: new Date(),
          },
          {
            where: {
              remember_token_hash: rememberTokenHash,
              account_status: 'active',
            },
          },
        );

        operations.push({
          type: 'remember_token_cleared',
          details: `Users updated: ${userUpdate[0]}`,
          token_hash: rememberTokenHash.substring(0, 8) + '...',
        });
      }

      // 3. Revoke all active sessions for the user (optional - for force logout)
      // This would require user_id which we might not have if token is invalid

      return {
        success: true,
        operations,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Logout service error:', error);
      throw new AppError('Logout failed', 500);
    }
  }

  /**
   * Revoke all sessions for a specific user (admin/force logout)
   */
  async revokeAllUserSessions(userId, role) {
    // Only admins can force logout
    if (role !== 'admin') {
      throw new AppError('Role not found or does not match.', 404);
    }
    try {
      const sessionsRevoked = await UserSession.revokeUserSessions(userId);

      // Also clear remember tokens
      await User.update(
        {
          remember_token_hash: null,
          remember_token_expires_at: null,
        },
        { where: { user_id: userId } },
      );

      return {
        success: true,
        sessionsRevoked: sessionsRevoked[0],
        userId,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Revoke all sessions error:', error);
      throw new AppError('Failed to revoke all sessions', 500);
    }
  }

  /**
   * Logout from specific device/session
   */
  async logoutFromDevice(sessionId, userId) {
    try {
      const session = await UserSession.findOne({
        where: {
          session_id: sessionId,
          user_id: userId,
          revoked: false,
        },
      });

      if (!session) {
        throw new AppError('Session not found or already revoked', 404);
      }

      await session.update({
        revoked: true,
        revoked_at: new Date(),
        device_name: 'Revoked by User',
      });

      return {
        success: true,
        sessionId,
        revokedAt: new Date(),
      };
    } catch (error) {
      console.error('Logout from device error:', error);
      throw error;
    }
  }
})();
