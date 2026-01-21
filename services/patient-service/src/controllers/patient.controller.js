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

export const getPatientMedicalRecord = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;
  const filters = req.query;

  const medRecords = await patientService.getPatientMedicalRecord(
    patientUuid,
    filters
  );

  messageSender(200, `Medical records fetch successfully`, medRecords, res);
});

export const getPatient = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const patient = await patientService.getPatient(search);

  messageSender(200, 'Patient fetched successfully.', patient, res);
});
