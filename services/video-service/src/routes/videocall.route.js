import express from 'express';

import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

import * as videoCallController from '../controllers/videocall.controller.js';

const router = express.Router();

router.get(
  '/appointments/today',
  authenticate,
  videoCallController.getTodaysOnlineConsultation
);

router.post('/create-room', authenticate, videoCallController.createRoom);

router.get(
  '/:roomId/room-details',
  authenticate,
  videoCallController.getRoomDetails
);

router.delete(
  '/:roomId/delete-room',
  [authenticate, authorizeRole('doctor')],
  videoCallController.deleteRoom
);

router.patch('/disconnected-user', videoCallController.userDisconnect);

router.patch('/:roomId/join-room', authenticate, videoCallController.joinRoom);

router.patch(
  '/:roomId/leave-room',
  authenticate,
  videoCallController.leaveRoom
);

router.patch(
  '/:roomId/rejoin-room',
  authenticate,
  videoCallController.rejoinRoom
);

router.get('/:roomId/status', authenticate, videoCallController.getRoomStatus);

export default router;
