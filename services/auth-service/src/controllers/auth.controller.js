import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import authService from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { userAgent, ipAddress } = req.clientInfo;

  const user = await authService.login(email, password, userAgent, ipAddress);

  res.cookie('jwt', user.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  messageSender(200, 'User logged in successfully.', user, res);
});

export const getAllUser = asyncHandler(async (req, res) => {
  const allUsers = await authService.getAllUser();

  messageSender(200, 'Retrieved all users successfully.', allUsers, res);
});

export const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await authService.getUserById(userId);

  messageSender(200, 'User retrieved successfully.', user, res);
});

export const activateAndInactivateToggle = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { userId } = req.params;
  const { userAgent, ipAddress } = req.clientInfo;

  const userNewStatus = await authService.activateAndInactivateUser(
    userId,
    status,
    userAgent,
    ipAddress
  );

  messageSender(200, 'User changed status successfully.', userNewStatus, res);
});

export const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const { userAgent, ipAddress } = req.clientInfo;

  const updatedUser = await authService.updateUser(
    userId,
    req.body,
    userAgent,
    ipAddress
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { userAgent, ipAddress } = req.clientInfo;

  const deletedUser = await authService.deleteUser(
    userId,
    userAgent,
    ipAddress
  );

  messageSender(200, 'User deleted successfully.', deletedUser, res);
});

export const getProfile = asyncHandler(async (req, res) => {
  const { user_id } = req.user;

  const userProfile = await authService.getProfile(user_id);

  messageSender(200, 'User profile retrieved successfully.', userProfile, res);
});

export const logout = asyncHandler(async (req, res) => {
  const { ipAddress, userAgent } = req.clientInfo;

  // Clear the HTTP-only cookie
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  });

  // If user is authenticated, log the logout
  if (req.user) {
    const { jwt } = req.user;
    const loggedOutUser = await authService.logout(jwt, ipAddress, userAgent);
  }

  messageSender(200, 'Logged out successfully', {}, res);
});
