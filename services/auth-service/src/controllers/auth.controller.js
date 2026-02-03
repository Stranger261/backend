import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import authService from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const { userAgent, ipAddress } = req.clientInfo;

  const user = await authService.login(
    email,
    password,
    userAgent,
    ipAddress,
    rememberMe,
  );

  if (user.requiresOtp) {
    return messageSender(
      200,
      user.message,
      {
        requiresOtp: true,
        email: user.email,
        deviceFingerprint: user.deviceFingerprint,
        mfaMethod: user.mfaMethod,
      },
      res,
    );
  }
  const jwtMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;

  res.cookie('jwt', user.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: jwtMaxAge,
  });

  if (rememberMe && user.rememberToken) {
    res.cookie('remember_token', user.rememberToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  messageSender(200, 'User logged in successfully.', user, res);
});

export const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otpCode, trustDevice, rememberMe, deviceFingerprint } =
    req.body;
  const { userAgent, ipAddress } = req.clientInfo;

  const result = await authService.verifyOTPAndLogin(
    email,
    otpCode,
    userAgent,
    ipAddress,
    trustDevice,
    rememberMe,
    deviceFingerprint,
  );

  // Set JWT cookie
  const jwtMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;

  res.cookie('jwt', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: jwtMaxAge,
  });

  // Set remember me token if provided
  if (rememberMe && result.rememberToken) {
    res.cookie('remember_token', result.rememberToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  messageSender(200, 'OTP verified successfully.', result, res);
});

export const autoLogin = asyncHandler(async (req, res) => {
  const rememberToken = req.cookies.remember_token;
  const { userAgent, ipAddress } = req.clientInfo;

  const result = await authService.loginWithRememberToken(
    rememberToken,
    userAgent,
    ipAddress,
  );

  res.cookie('jwt', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  messageSender(200, 'Auto-login successful.', result.user, res);
});

export const resendLoginOTP = asyncHandler(async (req, res) => {
  const { email, ipAddress } = req.body;

  const response = await authService.resendLoginOTP(email, ipAddress);

  messageSender(200, response.message, response, res);
});

export const logout = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const token = req.cookies.jwt;

  await authService.logout(userId, token);

  res.clearCookie('jwt');
  res.clearCookie('remember_token');

  messageSender(200, 'Logged out successfully.', null, res);
});

// Enable 2FA
export const enable2FA = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { method } = req.body;

  const result = await authService.enable2FA(userId, method);

  messageSender(200, result.message, { method: result.method }, res);
});

// Disable 2FA
export const disable2FA = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const result = await authService.disable2FA(userId);

  messageSender(200, result.message, null, res);
});

export const get2FAStatus = asyncHandler(async (req, res) => {
  const userId = req.user.user_id; // From authenticate middleware

  const status = await authService.get2FAStatus(userId);

  messageSender(200, '2FA status retrieved successfully.', status, res);
});
// Get trusted devices
export const getTrustedDevices = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const devices = await authService.getTrustedDevices(userId);

  messageSender(200, 'Trusted devices retrieved successfully.', devices, res);
});

// Revoke trusted device
export const revokeTrustedDevice = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { deviceId } = req.params;

  const result = await authService.revokeTrustedDevice(userId, deviceId);

  messageSender(200, result.message, null, res);
});

export const getAllUser = asyncHandler(async (req, res) => {
  const allUsers = await authService.getAllUser();

  messageSender(200, 'Retrieved all users successfully.', allUsers, res);
});

export const getUserById = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;

  const user = await authService.getUserById(userUuid);

  messageSender(200, 'User retrieved successfully.', user, res);
});

export const activateAndInactivateToggle = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { userUuid } = req.params;
  const { userAgent, ipAddress } = req.clientInfo;

  const userNewStatus = await authService.activateAndInactivateUser(
    userUuid,
    status,
    userAgent,
    ipAddress,
  );

  messageSender(200, 'User changed status successfully.', userNewStatus, res);
});

export const updateUser = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;

  const { userAgent, ipAddress } = req.clientInfo;

  const updatedUser = await authService.updateUser(
    userUuid,
    req.body,
    userAgent,
    ipAddress,
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { userAgent, ipAddress } = req.clientInfo;

  const deletedUser = await authService.deleteUser(
    userUuid,
    userAgent,
    ipAddress,
  );

  messageSender(200, 'User deleted successfully.', deletedUser, res);
});

export const getProfile = asyncHandler(async (req, res) => {
  const { user_uuid } = req.user;

  const userProfile = await authService.getProfile(user_uuid);

  messageSender(200, 'User profile retrieved successfully.', userProfile, res);
});

/**
 * Admin endpoint to force logout user from all devices
 */
export const forceLogoutUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.user;

  const result = await authService.revokeAllUserSessions(userId, role);

  messageSender(200, 'User logged out from all devices', result, res);
});

/**
 * Logout from specific device
 */
export const logoutFromDevice = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.user_id;

  const result = await authService.logoutFromDevice(sessionId, userId);

  messageSender(200, 'Logged out from device', result, res);
});
