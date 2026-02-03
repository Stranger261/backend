// doctorAdmission.controller.js
import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import DoctorAdmissionService from '../services/doctorAdmission.service.js';

// Get doctor's admissions (only patients assigned to this doctor)
export const getDoctorAdmissions = asyncHandler(async (req, res) => {
  const doctorId = req?.user?.staff_id;
  const filters = req.query;

  const result = await DoctorAdmissionService.getDoctorAdmissions(
    doctorId,
    filters,
  );

  messageSender(200, 'Doctor admissions fetched successfully.', result, res);
});

// Get detailed view of a specific admission (doctor access check)
export const getDoctorAdmissionDetails = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;
  const doctorId = req?.user?.staff_id;

  const admission = await DoctorAdmissionService.getAdmissionDetails(
    admissionId,
    doctorId,
  );

  messageSender(200, 'Admission details fetched successfully.', admission, res);
});

// Create a doctor's progress note (doctor round)
export const createDoctorRoundNote = asyncHandler(async (req, res) => {
  const { noteData } = req.body;
  const doctorId = req?.user?.staff_id;
  const { admissionId } = req.params;

  const note = await DoctorAdmissionService.createDoctorRoundNote(
    admissionId,
    doctorId,
    { ...noteData, admissionId },
  );

  messageSender(201, 'Doctor round note created successfully.', note, res);
});

// Update diagnosis or treatment plan (doctor only)
export const updateAdmissionDiagnosis = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;
  const doctorId = req?.user?.staff_id;
  const updates = req.body;

  const admission = await DoctorAdmissionService.updateAdmissionDiagnosis(
    admissionId,
    doctorId,
    updates,
  );

  messageSender(200, 'Diagnosis updated successfully.', admission, res);
});

// Request discharge for a patient (initiate discharge workflow)
export const requestPatientDischarge = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;
  const doctorId = req?.user?.staff_id;
  const dischargeData = req.body;

  const result = await DoctorAdmissionService.requestDischarge(
    admissionId,
    doctorId,
    dischargeData,
  );

  messageSender(200, 'Discharge request submitted successfully.', result, res);
});

// Get doctor's admission statistics
export const getDoctorAdmissionStats = asyncHandler(async (req, res) => {
  const doctorId = req?.user?.staff_id;
  const { period = 'month' } = req.query;

  const stats = await DoctorAdmissionService.getAdmissionStats(
    doctorId,
    period,
  );

  messageSender(200, 'Admission statistics fetched successfully.', stats, res);
});

// Get patients for doctor's rounds (who needs attention today)
export const getPatientsForDoctorRounds = asyncHandler(async (req, res) => {
  const doctorId = req?.user?.staff_id;
  const { floor } = req.query;

  const patients = await DoctorAdmissionService.getPatientsForRounds(
    doctorId,
    floor,
  );

  messageSender(
    200,
    'Patients for rounds fetched successfully.',
    patients,
    res,
  );
});

// Get admission progress notes with doctor-specific view
export const getDoctorAdmissionProgressNotes = asyncHandler(
  async (req, res) => {
    const { admissionId } = req.params;
    const doctorId = req?.user?.staff_id;

    const notes = await DoctorAdmissionService.getAdmissionProgressNotes(
      admissionId,
      doctorId,
    );

    messageSender(200, 'Progress notes fetched successfully.', notes, res);
  },
);
