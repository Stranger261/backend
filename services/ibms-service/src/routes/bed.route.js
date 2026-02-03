import express from 'express';
import {
  authenticate,
  authorizeRole,
  protectInternalApi,
} from '../../../shared/middleware/auth.middleware.js';

import * as bedController from '../controllers/bed.controller.js';

const router = express.Router();

// read operations
router.get('/floor-summary', protectInternalApi, bedController.getFloorSummary);
router.get(
  '/room/:floorNumber',
  protectInternalApi,
  bedController.getRoomsSummary,
);
router.get('/:roomId/beds', protectInternalApi, bedController.getRoomsBeds);
router.get('/available', protectInternalApi, bedController.getAvailableBed);
router.get('/all', authenticate, bedController.getAllBeds);
router.get('/:bedId', protectInternalApi, bedController.getBedDetails);

// stats and reporting
router.get(
  '/stats/occupancy',
  authenticate,
  bedController.getBedOccupancyStats,
);
router.get(
  '/stats/attention',
  authenticate,
  bedController.getBedsRequiringAttention,
);

// manual updates
router.patch(
  '/:bedId/status',
  [authenticate, protectInternalApi],
  bedController.updateBedStatus,
);
router.post(
  '/:bedId/maintenance',
  [authenticate, authorizeRole('nurse', 'admin', 'maintenance')],
  bedController.markBedForMaintenance,
);
// Cleaning operations (Housekeeping, Nurse)
router.patch(
  '/:bedId/cleaned',
  [authenticate, authorizeRole('housekeeping', 'nurse')],
  bedController.markBedCleaned,
);
// Reservation operations (Receptionist, Nurse, Doctor)
router.post(
  '/:bedId/reserve',
  [authenticate, authorizeRole('receptionist', 'nurse', 'doctor')],
  bedController.reserveBed,
);
router.delete(
  '/:bedId/reserve',
  [authenticate, authorizeRole('receptionist', 'nurse', 'doctor')],
  bedController.cancelBedReservation,
);

// history
router.get('/:bedId/history', authenticate, bedController.getBedStatusHistory);
router.get('/logs/recent', authenticate, bedController.getRecentStatusChanges);
export default router;
