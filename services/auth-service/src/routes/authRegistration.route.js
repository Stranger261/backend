import express from 'express';

import * as authRegistration from '../controllers/authRegistration.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { attachRequestInfo } from '../../../shared/middleware/attachReqInfo.middleware.js';
import upload from '../../../shared/middleware/multer.middleware.js';

const router = express.Router();

router.post(
  '/initial-registration',
  attachRequestInfo,
  authRegistration.initialRegistration
);
router.post(
  '/verify-email',
  [authenticate, attachRequestInfo],
  authRegistration.verifyEmail
);
router.post(
  '/resend-otp',
  [authenticate, attachRequestInfo],
  authRegistration.resendOTP
);
router.post(
  '/ocr',
  [upload.single('image'), authenticate],
  authRegistration.OCR
);
router.post(
  '/complete-profile',
  [upload.single('id_photo'), authenticate, attachRequestInfo],
  authRegistration.completeProfileWithID
);
router.post(
  '/complete-face-verification',
  [authenticate, attachRequestInfo],
  authRegistration.completeFaceVerification
);
router.get('/health', (req, res) => {
  res.send({ message: 'working' });
});
export default router;
