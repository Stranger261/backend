import express from 'express';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import * as appointmentVitalsController from '../controllers/appointmentVitals.controller.js';

const router = express.Router();

// Create vitals (Nurse only)
router.post(
  '/',
  [authenticate, authorizeRole('nurse', 'triage_nurse')],
  appointmentVitalsController.createVitals,
);

// Update vitals (Nurse only)
router.patch(
  '/:appointmentId',
  [authenticate, authorizeRole('nurse', 'triage_nurse')],
  appointmentVitalsController.updateVitals,
);

// Get vitals by appointment (Doctor, Nurse)
router.get(
  '/appointment/:appointmentId',
  [authenticate, authorizeRole('doctor', 'nurse', 'triage_nurse')],
  appointmentVitalsController.getVitalsByAppointment,
);

// Get patient vitals history (Doctor, Nurse)
router.get(
  '/patient/:patientId/history',
  [authenticate, authorizeRole('doctor', 'nurse', 'triage_nurse')],
  appointmentVitalsController.getPatientVitalsHistory,
);

export default router;
