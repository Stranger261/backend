// doctorAdmission.routes.js
import express from 'express';
import {
  getDoctorAdmissions,
  getDoctorAdmissionDetails, // Fixed: was getAdmissionDetails
  createDoctorRoundNote,
  updateAdmissionDiagnosis, // Fixed: was updateDiagnosis
  requestPatientDischarge, // Fixed: was requestDischarge
  getDoctorAdmissionStats, // Fixed: was getAdmissionStats
  getPatientsForDoctorRounds, // Fixed: was getPatientsForRounds
  getDoctorAdmissionProgressNotes, // Fixed: was getAdmissionProgressNotes
} from '../controllers/doctorAdmission.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication and doctor role
router.use(authenticate);
router.use(
  authorizeRole('doctor', 'senior_doctor', 'consultant', 'head_of_department'),
);

// Get doctor's admissions
router.get('/my-admissions', getDoctorAdmissions);

// Get admission statistics
router.get('/stats', getDoctorAdmissionStats);

// Get patients for rounds
router.get('/rounds/patients', getPatientsForDoctorRounds);

// Admission-specific routes
router.route('/:admissionId').get(getDoctorAdmissionDetails);

router.route('/:admissionId/notes').get(getDoctorAdmissionProgressNotes);

router.route('/:admissionId/doctor-round').post(createDoctorRoundNote);

router.route('/:admissionId/diagnosis').patch(updateAdmissionDiagnosis);

router.route('/:admissionId/discharge-request').post(requestPatientDischarge);

export default router;
