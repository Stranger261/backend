import express from 'express';
import medicalRecordsController from '../controllers/medicalRecord.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import { attachRequestInfo } from '../../../shared/middleware/attachReqInfo.middleware.js';

const router = express.Router();

/**
 * Medical Records Routes
 * All routes require authentication
 * Access control is handled by the service layer based on HIPAA compliance rules
 */

// Get current user's medical records (for patients)
router.get(
  '/',
  [authenticate, attachRequestInfo],
  medicalRecordsController.getMyMedicalRecords,
);

// Get medical records summary
router.get(
  '/summary',
  [authenticate, attachRequestInfo],
  medicalRecordsController.getMedicalRecordsSummary,
);

// Get specific patient's medical records (for healthcare providers)
router.get(
  '/patient/:patientId',
  [authenticate, authorizeRole('doctor', 'nurse', 'admin'), attachRequestInfo],
  medicalRecordsController.getPatientMedicalRecords,
);

// Get detailed view of a specific record
router.get(
  '/:recordType/:recordId',
  [authenticate, attachRequestInfo],
  medicalRecordsController.getRecordDetails,
);

export default router;
