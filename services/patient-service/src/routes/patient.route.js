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
  patientController.getDoctorsPatients,
);

router.get(
  '/:patientUuid/med-records',
  authenticate,
  patientController.getPatientMedicalRecord,
);

router.get(
  '/:patientUuid/med-history',
  authenticate,
  patientController.getPatientMedicalHistory,
);

router.get(
  '/',
  [authenticate, authorizeRole('receptionist', 'doctor', 'nurse')],
  patientController.getPatient,
);

export default router;
