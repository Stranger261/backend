import express from 'express';

import { authenticate } from '../../../shared/middleware/auth.middleware.js';

import * as notificationController from '../controllers/notification.controller.js';

const router = express.Router();

router.get(
  '/user-notifications',
  authenticate,
  notificationController.getUserNotification
);

router.get(
  '/user-notificationsCount',
  authenticate,
  notificationController.getUserNotificationCount
);

router.patch(
  '/notification/:notifId',
  authenticate,
  notificationController.readNotification
);

router.patch(
  '/read-all',
  authenticate,
  notificationController.readAllUserNotification
);

export default router;
