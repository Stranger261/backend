import express from 'express';
import { protectInternalApi } from '../../../shared/middleware/auth.middleware.js';

import * as kioskController from '../controllers/kiosk.controller.js';

const router = express.Router();

router.patch(
  '/verify-arrived-appointment',
  protectInternalApi,
  kioskController.verifyAppointmentArrival,
);

router.post(
  '/patient-medical-records',
  kioskController.getPatientMedicalRecords,
);

export default router;
