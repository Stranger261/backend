import express from 'express';

import * as authController from '../controllers/auth.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import { attachRequestInfo } from '../../../shared/middleware/attachReqInfo.middleware.js';

const router = express.Router();

router.post('/login', attachRequestInfo, authController.login);
router.get(
  '/user/all',
  authenticate,
  authorizeRole('admin'),
  authController.getAllUser
);
router.get(
  '/user/:userId',
  authenticate,
  authorizeRole('admin', 'receptionist'),
  authController.getUserById
);
router.get('/user-profile', authenticate, authController.getProfile);
router.patch(
  '/quick-status-action/:userId',
  authenticate,
  authorizeRole('admin', 'receptionist'),
  authController.activateAndInactivateToggle
);
router.patch(
  '/update/:userId',
  authenticate,
  authorizeRole('admin', 'patient'),
  authController.updateUser
);
router.patch(
  '/delete/:id',
  authenticate,
  authorizeRole('admin'),
  authController.deleteUser
);

router.post(
  '/logout',
  [authenticate, attachRequestInfo],
  authController.logout
);
export default router;
