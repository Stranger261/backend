import express from 'express';
import {
  authenticate,
  authorizeRole,
  protectInternalApi,
} from '../../../shared/middleware/auth.middleware.js';
import * as bedAssignmentController from '../controllers/bedAssignment.controller.js';

const router = express.Router();

// Assign bed to admission (Doctor, Nurse, Receptionist)
router.post(
  '/assign',
  [authenticate, authorizeRole('doctor', 'nurse', 'receptionist')],
  bedAssignmentController.assignBed,
);

// Release bed from admission (Doctor, Nurse)
router.post(
  '/release',
  [authenticate, authorizeRole('doctor', 'nurse')],
  bedAssignmentController.releaseBed,
);

// Transfer patient to different bed (Doctor, Nurse)
router.post(
  '/transfer',
  [authenticate, authorizeRole('doctor', 'nurse')],
  bedAssignmentController.transferBed,
);

// Get current bed for admission
router.get(
  '/admission/:admissionId/current',
  authenticate,
  bedAssignmentController.getCurrentBed,
);

// get all adimissions
router.get(
  '/admission',
  authenticate,
  bedAssignmentController.getAllAdmissions,
);

// Get bed assignment history
router.get(
  '/admission/:admissionId/history',
  authenticate,
  bedAssignmentController.getBedHistory,
);

// Mark bed as cleaned (Housekeeping, Nurse)
router.patch(
  '/:bedId/cleaned',
  [authenticate, authorizeRole('nurse', 'housekeeping')],
  bedAssignmentController.markBedCleaned,
);

router.post(
  '/external/release',
  protectInternalApi,
  bedAssignmentController.releaseBed,
);

export default router;
