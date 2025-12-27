import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';

import notificationService from '../services/notification.service.js';

export const getUserNotification = asyncHandler(async (req, res) => {
  const { user_uuid } = req.user;
  const filters = req.query;

  const userNotif = await notificationService.getUserNotification(
    user_uuid,
    filters
  );

  messageSender(200, 'User notification fetch successfully.', userNotif, res);
});

export const readNotification = asyncHandler(async (req, res) => {
  const { notifId } = req.params;

  const notif = await notificationService.readNotification(notifId);

  messageSender(200, 'User notif has been read.', notif, res);
});

export const readAllUserNotification = asyncHandler(async (req, res) => {
  const { user_uuid } = req.user;

  const newAllNotif = await notificationService.readAllUserNotification(
    user_uuid
  );

  messageSender(200, 'User notif has been read.', newAllNotif, res);
});
