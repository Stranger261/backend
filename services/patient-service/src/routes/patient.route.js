import express from 'express';

import * as patientController from '../controllers/patient.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.get(
  '/doctors/:doctorUuid/patients',
  [authenticate, authorizeRole('doctor', 'receptionist', 'nurse')],
  patientController.getDoctorsPatients
);

export default router;
