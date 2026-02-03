/**
 * Care Team Routes
 * Routes for managing nurse assignments to patients
 */

import express from 'express';
import {
  assignNurseToPatient,
  removeNurseFromPatient,
  bulkAssignNurse,
  transferPatientNurse,
  getPatientCareTeam,
} from '../controllers/careTeam.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/care-team/assign-nurse
 * @desc    Assign a nurse to a patient
 * @access  Private (Doctor, Head Nurse, Admin)
 * @body    { patientUuid, nurseStaffUuid, reason }
 */
router.post(
  '/assign-nurse',
  authorizeRole('doctor', 'admin', 'head_nurse'),
  assignNurseToPatient,
);

/**
 * @route   DELETE /api/care-team/remove-nurse
 * @desc    Remove a nurse from a patient
 * @access  Private (Doctor, Head Nurse, Admin)
 * @body    { patientUuid, nurseStaffUuid }
 */
router.delete(
  '/remove-nurse',
  authorizeRole('doctor', 'admin', 'head_nurse'),
  removeNurseFromPatient,
);

/**
 * @route   POST /api/care-team/bulk-assign-nurse
 * @desc    Bulk assign a nurse to multiple patients
 * @access  Private (Head Nurse, Admin)
 * @body    { patientUuids: [], nurseStaffUuid, reason }
 */
router.post(
  '/bulk-assign-nurse',
  authorizeRole('admin', 'head_nurse'),
  bulkAssignNurse,
);

/**
 * @route   PUT /api/care-team/transfer-nurse
 * @desc    Transfer patient from one nurse to another
 * @access  Private (Doctor, Head Nurse, Admin)
 * @body    { patientUuid, oldNurseStaffUuid, newNurseStaffUuid, reason }
 */
router.put(
  '/transfer-nurse',
  authorizeRole('doctor', 'admin', 'head_nurse'),
  transferPatientNurse,
);

/**
 * @route   GET /api/care-team/patient/:patientUuid
 * @desc    Get patient's current care team
 * @access  Private (Doctor, Nurse, Admin)
 * @params  patientUuid
 */
router.get(
  '/patient/:patientUuid',
  authorizeRole('doctor', 'nurse', 'admin', 'head_nurse'),
  getPatientCareTeam,
);

export default router;
