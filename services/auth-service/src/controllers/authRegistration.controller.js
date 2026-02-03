import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';

import authRegistration from '../services/authRegistration.service.js';

export const initialRegistration = asyncHandler(async (req, res) => {
  const { email, password, phone } = req.body;
  const { ipAddress, userAgent } = req.clientInfo;

  const newUser = await authRegistration.initialRegistration(
    email,
    phone,
    password,
    userAgent,
    ipAddress,
  );

  res.cookie('jwt', newUser.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  messageSender(
    201,
    'Initial registration completed successfully.',
    newUser,
    res,
  );
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email } = req.user;
  const { token } = req.body;
  const { ipAddress, userAgent } = req.clientInfo;

  const verifiedUserEmail = await authRegistration.verifyEmail(
    email,
    token,
    userAgent,
    ipAddress,
  );

  messageSender(200, 'Email verified successfully.', verifiedUserEmail, res);
});

export const resendOTP = asyncHandler(async (req, res) => {
  const { user_uuid } = req?.user;
  const { ipAddress } = req.clientInfo;

  const newOTP = await authRegistration.resendOTP(user_uuid, ipAddress);

  messageSender(200, 'New otp sent to email', newOTP, res);
});

export const OCR = asyncHandler(async (req, res) => {
  const { file } = req;

  const ocrResult = await authRegistration.OCR(file);

  messageSender(200, 'File extracted successfully', ocrResult, res);
});

export const completeProfileWithID = asyncHandler(async (req, res) => {
  const { user_uuid, email } = req.user;
  const { userAgent, ipAddress } = req.clientInfo;
  const idPhotoBuffer = req.file?.buffer;
  const formData = { ...req.body, email };

  const result = await authRegistration.completeProfileWithID(
    user_uuid,
    formData,
    idPhotoBuffer,
    userAgent,
    ipAddress,
  );

  messageSender(200, result.message, result, res);
});

export const completeFaceVerification = asyncHandler(async (req, res) => {
  const { user_uuid: userUUID } = req.user;
  const { userAgent, ipAddress } = req.clientInfo;
  const { livePhotoBase64 } = req.body;

  const result = await authRegistration.verifyLiveFace({
    userUUID,
    livePhotoBase64,
    userAgent,
    ipAddress,
  });

  messageSender(
    200,
    'Face verification successful! Your account is now active.',
    result,
    res,
  );
});
