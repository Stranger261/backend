import { createFacePlusPlusService } from '../services/facePlusPlus.service.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';

// Create service instance when controller is used
const facePlusPlusService = createFacePlusPlusService();

export const verifyUserFace = asyncHandler(async (req, res) => {
  const { ipAddress, userAgent } = req.clientInfo;
  const { liveImageBase64 } = req.body;
  const userUUID = req.user.user_uuid;

  const verification = await facePlusPlusService.verifyFaces(
    liveImageBase64,
    userUUID,
    ipAddress,
    userAgent
  );

  messageSender(
    200,
    'Face verification completed successfully',
    verification,
    res
  );
});

export const detectFace = asyncHandler(async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({
      success: false,
      message: 'imageBase64 is required',
    });
  }

  const faceData = await facePlusPlusService.detectFace(imageBase64);

  res.status(200).json({
    success: true,
    message: 'Face detected successfully',
    data: faceData,
  });
});

export const compareFaces = asyncHandler(async (req, res) => {
  const { faceToken1, faceToken2 } = req.body;

  if (!faceToken1 || !faceToken2) {
    return res.status(400).json({
      success: false,
      message: 'Both faceToken1 and faceToken2 are required',
    });
  }

  const comparison = await facePlusPlusService.compareFaces(
    faceToken1,
    faceToken2
  );

  res.status(200).json({
    success: true,
    message: 'Faces compared successfully',
    data: comparison,
  });
});

export const healthCheck = asyncHandler(async (req, res) => {
  const healthStatus = await facePlusPlusService.healthCheck();

  res.status(200).json({
    success: true,
    message: 'Face++ service health check completed',
    data: healthStatus,
  });
});
