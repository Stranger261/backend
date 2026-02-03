import express from 'express';

import * as patientController from '../controllers/patient.controller.js';
import {
  authenticate,
  authorizeRole,
  protectInternalApi,
} from '../../../shared/middleware/auth.middleware.js';
import { attachRequestInfo } from '../../../shared/middleware/attachReqInfo.middleware.js';

const router = express.Router();

router.get(
  '/doctors/:doctorUuid/patients',
  [authenticate, authorizeRole('doctor', 'receptionist', 'nurse')],
  patientController.getDoctorsPatients,
);

router.get(
  '/:patientUuid/med-records',
  [authenticate, authorizeRole('doctor', 'nurse')],
  patientController.getPatientMedicalRecord,
);

router.get('/:patientUuid/details', [
  authenticate,
  // authorizeRole('doctor', 'nurse', 'receptionist'),
  patientController.getPatientDetails,
]);

router.get(
  '/:patientUuid/med-history',
  authenticate,
  patientController.getPatientMedicalHistory,
);

// add person face
router.post(
  '/add-face/:personId',
  [attachRequestInfo, authenticate],
  patientController.addFaceToExistingPerson,
);

router.get(
  '/all',
  [
    attachRequestInfo,
    authenticate,
    authorizeRole('receptionist', 'nurse', 'admin'),
  ],
  patientController.getAllPatients,
);

router.get(
  '/',
  [authenticate, authorizeRole('receptionist', 'doctor', 'nurse')],
  patientController.getPatient,
);

//  nurse
/**
 * @route   GET /api/nurse/patients/:patientUuid
 * @desc    Get specific patient details (with care team validation)
 * @access  Private (Nurse only)
 * @params  patientUuid
 */
router.get(
  '/nurse/patients/:patientUuid',
  [authenticate, authorizeRole('nurse')],
  patientController.getNursePatientDetails,
);

/**
 * @route   GET /api/nurse/patients/:patientUuid/medical-records
 * @desc    Get patient medical records (with care team validation + HIPAA logging)
 * @access  Private (Nurse only)
 * @params  patientUuid
 * @query   page, limit, startDate, endDate, recordType, status, visitType, search
 */
router.get(
  '/nurse/patients/:patientUuid/medical-records',
  [authenticate, authorizeRole('nurse')],
  patientController.getNursePatientMedicalRecords,
);

/**
 * @route   GET /api/nurse/care-team
 * @desc    Get nurse's care team assignments
 * @access  Private (Nurse only)
 */
router.get(
  '/nurse/care-team',
  [authenticate, authorizeRole('nurse')],
  patientController.getNurseCareTeamAssignments,
);
// nurse
router.get(
  '/nurse/patients',
  [authenticate, authorizeRole('nurse')],
  patientController.getNursePatients,
);

router.get(
  '/external/patients',
  protectInternalApi,
  patientController.getAllPatients,
);

export default router;
