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
// shared util
import AppError from '../../../shared/utils/AppError.util.js';
import { activeRecord } from '../../../shared/helpers/queryFilters.helper.js';
import { patientApi } from '../../../shared/utils/apiUrl.util.js';
import { Person, Role, User, UserRole } from '../../../shared/models/index.js';

export default new (class authService {
  // constructor() {}

  // still needs audit and user
  async login(email, password, userAgent, ipAddress) {
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
          429
        );
      }

      const user = await User.findOne({
        where: { email, is_deleted: false },
      });

      if (!user) {
        const ipAttempts = await incrWithTTL(ipKey, THRESHOLD.IP_TTL);
        const emailAttempts = await incrWithTTL(emailKey, THRESHOLD.EMAIL_TTL);

        const isIpBlocked = ipAttempts >= THRESHOLD.IP_THRESHOLD;
        const isEmailBlocked = emailAttempts >= THRESHOLD.EMAIL_THRESHOLD;

        if (isIpBlocked || isEmailBlocked) {
          const blockedKey = `blocked:${hashedEmail}:${ipAddress}`;
          const alreadyBlocked = await getVal(blockedKey);

          if (!alreadyBlocked) {
            // await logSus;
            await incrWithTTL(blockedKey, THRESHOLD.IP_TTL);
          }
        }

        throw new AppError(
          'Email not found or login for this email is temporarily blocked.',
          429
        );
      }

      if (user.is_account_locked) {
        if (
          user.account_locked_until &&
          user.account_locked_until > new Date()
        ) {
          // await suspiciousLog()

          throw new AppError(
            `Account locked until ${user.account_locked_until.toISOString()}`,
            403
          );
        } else {
          user.is_account_locked = false;
          user.failed_login_attempts = 0;
          user.account_locked_until = null;

          // await user.save({transaction});
        }
      }

      const isMatch = await bcryptjs.compare(password, user.password_hash);

      if (!isMatch) {
        user.failed_login_attempts += 1;

        if (user.failed_login_attempts > process.env.MAX_FAILED_ATTEMPTS) {
          user.is_account_locked = true;
          user.account_locked_until = new Date(
            Date.now() + process.env.LOCK_DURATION_MINUTES * 60 * 1000
          );
        }

        await user.save();

        try {
          await incrWithTTL(ipKey, THRESHOLD.EMAIL_TTL);
          await incrWithTTL(`failed:email:${hashedEmail}`, THRESHOLD.EMAIL_TTL);
        } catch (error) {
          console.error('Redis error: ', error.message);
        }

        // await logAudit()
        throw new AppError('Incorrect password.', 400);
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

      // Check if user has any active roles
      if (roles.length === 0) {
        throw new AppError('No active roles assigned to this account.', 403);
      }

      // for mfa: check if mfa is enabled or email not verified
      if (user.mfa_enabled || user.is_email_verified) {
        const otpCode = otpGenerator();
        const expiresAt = new Date(
          Date.now() + process.env.OTP_EXPIRY_MINUTES * 60 * 1000
        );

        const isEmailSent = await sendOTPEmail(email, otpCode);
        if (!isEmailSent.success) {
          throw new AppError('Sending email failed. Please try again.', 500);
        }
        await OTPVerification.create({
          email,
          otp_code: otpCode,
          expires_at: expiresAt,
        });

        // await logAudit()

        return {
          reqiuresOtp: true,
          email,
          message: 'OTP sent to your email.',
        };
      }

      user.failed_login_attempts = 0;
      user.is_account_locked = false;
      user.account_locked_until = null;
      user.last_login = new Date();

      await user.save();

      const token = jwt.sign(
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

      const sanitizedUser = sanitizeUser(user, roles);

      // await logAudit()

      return { token, user: sanitizedUser };
    } catch (error) {
      console.log('Login failed: ', error);
      throw error instanceof AppError
        ? error
        : new AppError('Internal server error.', 500);
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
        (error instanceof AppError ? AppError : 'Internal server error.', 500)
      );
    }
  }

  async getUserById(userId) {
    try {
      const user = User.find({
        where: { user_id: userId },
      });

      if (!user) {
        throw new AppError('User not found or deleted/inactive.', 404);
      }

      return user;
    } catch (error) {
      console.log('Get user by ID error: ', error);
      throw (
        (error instanceof AppError ? AppError : 'Internal server error.', 500)
      );
    }
  }

  async activateAndInactivateUser(userId, status, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.update(
        { where: activeRecord({ user_id: userId, status }) },
        { transaction }
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
        (error instanceof AppError ? AppError : 'Internal server error.', 500)
      );
    }
  }

  async updateUser(userId, newData, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();
    try {
      const updatedUser = User.update(newData, {
        where: { user_id: userId },
        transaction,
      });
      if (!user) {
        throw new AppError('User not found.', 404);
      }

      await transaction.commit();

      return updatedUser;
    } catch (error) {
      await transaction.rollback();
      console.log('Updating user error: ', error);
      throw (
        (error instanceof AppError ? AppError : 'Internal server error', 500)
      );
    }
  }

  async deleteUser(userId, userAgent, ipAddress) {
    const transaction = await sequelize.transaction();

    try {
      const deletedUser = await User.update(
        { is_deleted: true, is_active: false },
        {
          where: activeRecord({ user_id: userId }),
        },
        transaction
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
        (error instanceof AppError ? AppError : 'Internal server error.', 500)
      );
    }
  }

  async getProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password_hash'] },
        include: [
          {
            model: Person,
            as: 'person',
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
            `/person/external/user/${user.user_uuid}`
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
        (error instanceof AppError ? AppError : 'Internal server error.', 500)
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

  async logout(token, userAgent, ipAddress) {
    try {
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // await logAudit(
        //   decoded.id,
        //   'logout',
        //   'success',
        //   ipAddress,
        //   userAgent,
        //   null
        // );
      }
    } catch (error) {
      // Even if token is invalid, we consider logout successful
      console.log('Logout with invalid token:', error.message);
    }
  }
})();
