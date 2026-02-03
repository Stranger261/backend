import express from 'express';

import * as authController from '../controllers/auth.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import { attachRequestInfo } from '../../../shared/middleware/attachReqInfo.middleware.js';
import { trackActivity } from '../../../shared/middleware/activityTracker.middleware.js';

const router = express.Router();

router.post('/login', attachRequestInfo, authController.login);
router.post('/verify-otp', attachRequestInfo, authController.verifyOTP);
router.post('/auto-login', attachRequestInfo, authController.autoLogin);

router.use([authenticate, trackActivity]);

router.post('/resendOTP', [attachRequestInfo], authController.resendLoginOTP);
router.post('/logout', [attachRequestInfo], authController.logout);
// 2FA Management
router.post('/2fa/enable', authController.enable2FA);
router.post('/2fa/disable', authController.disable2FA);
router.get('/2fa/status', authController.get2FAStatus);

// Trusted Devices Management
router.get('/2fa/trusted-devices', authController.getTrustedDevices);
router.delete(
  '/2fa/trusted-devices/:deviceId',
  authController.revokeTrustedDevice,
);

router.get('/user/all', authorizeRole('admin'), authController.getAllUser);

router.get(
  '/user/:userUuid',
  authorizeRole('admin', 'receptionist'),
  authController.getUserById,
);

router.get('/user-profile', authController.getProfile);

router.patch(
  '/quick-status-action/:userUuid',
  authorizeRole('admin', 'receptionist'),
  authController.activateAndInactivateToggle,
);

router.patch(
  '/update/:userUuid',
  authorizeRole('admin', 'patient'),
  authController.updateUser,
);

router.patch(
  '/delete/:userUuid',
  authorizeRole('admin'),
  authController.deleteUser,
);

// Logout from specific device
router.delete(
  '/sessions/:sessionId',
  [, authorizeRole('admin')],
  authController.logoutFromDevice,
);

// Admin routes
router.post(
  '/admin/logout/:userId',
  [, authorizeRole('admin')],
  authController.forceLogoutUser,
);

export default router;
