import express from 'express';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import * as appointmentDiagnosisController from '../controllers/appointmentDiagnosis.controller.js';

const router = express.Router();

// Create diagnosis (Doctor only)
router.post(
  '/',
  [authenticate, authorizeRole('doctor')],
  appointmentDiagnosisController.createDiagnosis,
);

// Update diagnosis (Doctor only)
router.patch(
  '/:appointmentId',
  [authenticate, authorizeRole('doctor')],
  appointmentDiagnosisController.updateDiagnosis,
);

// Get diagnosis by appointment (Doctor, Nurse)
router.get(
  '/appointment/:appointmentId',
  [authenticate, authorizeRole('doctor', 'nurse')],
  appointmentDiagnosisController.getDiagnosisByAppointment,
);

export default router;
