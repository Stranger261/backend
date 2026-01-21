import express from 'express';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import * as appointmentConsultationController from '../controllers/appointmentConsultation.controller.js';

const router = express.Router();

// Get complete consultation data
router.get(
  '/:appointmentId',
  [authenticate, authorizeRole('doctor', 'nurse')],
  appointmentConsultationController.getCompleteConsultation,
);

// Get patient consultation history
router.get(
  '/patient/:patientId/history',
  [authenticate, authorizeRole('doctor', 'nurse')],
  appointmentConsultationController.getPatientConsultationHistory,
);

// Start consultation (Doctor only)
router.post(
  '/:appointmentId/start',
  [authenticate, authorizeRole('doctor')],
  appointmentConsultationController.startConsultation,
);

// Complete consultation (Doctor only)
router.post(
  '/:appointmentId/complete',
  [authenticate, authorizeRole('doctor')],
  appointmentConsultationController.completeConsultation,
);

export default router;
