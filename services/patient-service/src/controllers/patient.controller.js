import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import patientService from '../services/patient.service.js';

export const getDoctorsPatients = asyncHandler(async (req, res) => {
  const { doctorUuid } = req.params;
  const filters = req.query;

  const patients = await patientService.getDoctorsPatients(doctorUuid, filters);

  messageSender(200, `Doctor's patients fetch successfully`, patients, res);
});

export const getPatientMedicalHistory = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;
  const filters = req.query;

  const patientMedHistory = await patientService.getPatientMedicalHistory(
    patientUuid,
    filters
  );
  console.log(patientMedHistory);

  messageSender(200, 'Fetched successfully.', patientMedHistory, res);
});
