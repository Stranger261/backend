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
    filters,
  );

  messageSender(200, 'Fetched successfully.', patientMedHistory, res);
});

export const getPatientMedicalRecord = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;
  const filters = req.query;

  const role = req?.user?.role;

  const medRecords = await patientService.getPatientMedicalRecord(
    patientUuid,
    filters,
    role,
  );

  messageSender(200, `Medical records fetch successfully`, medRecords, res);
});

export const getPatientDetails = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;

  const patient = await patientService.getPatientDetails(patientUuid);

  messageSender(200, 'Fetched successfully.', patient, res);
});

export const getPatient = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const patient = await patientService.getPatient(search);

  messageSender(200, 'Patient fetched successfully.', patient, res);
});

export const getAllPatients = asyncHandler(async (req, res) => {
  const filters = req.query;

  const result = await patientService.getAllPatients(filters);

  messageSender(200, 'Patients retrieved successfully', result, res);
});

export const addFaceToExistingPerson = asyncHandler(async (req, res) => {
  const { ipAddress, userAgent } = req.clientInfo;

  const { personId, faceImageBase64, staffId } = req.body;

  const data = {
    personId,
    faceImageBase64,
    staffId,
    ipAddress,
    userAgent,
  };

  const result = await patientService.addFaceToExistingPerson(data);

  messageSender(
    200,
    result.message || 'Face registered successfully',
    result.data,
    res,
  );
});

export const getNursePatients = asyncHandler(async (req, res) => {
  const nurseUuid = req.user.staff_uuid;
  const filters = req.query;

  const result = await patientService.getNursesPatients(nurseUuid, filters);

  messageSender(200, 'Nurse patients retrieved successfully', result, res);
});

export const getNursePatientDetails = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;
  const nurseStaffId = req.user.staff_id;

  const patientDetails = await patientService.getNursePatientDetails(
    patientUuid,
    nurseStaffId,
  );

  messageSender(
    200,
    'Patient details retrieved successfully',
    patientDetails,
    res,
  );
});

export const getNursePatientMedicalRecords = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;
  const nurseStaffId = req.user.staff_id;
  const nurseUserId = req.user.user_id;
  const filters = req.query;

  const requestInfo = {
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    sessionId: req.session?.id || null,
  };

  const records = await patientService.getNursePatientMedicalRecords(
    patientUuid,
    nurseStaffId,
    nurseUserId,
    filters,
    requestInfo,
  );

  messageSender(200, 'Medical records retrieved successfully', records, res);
});

export const getNurseCareTeamAssignments = asyncHandler(async (req, res) => {
  const nurseStaffId = req.user.staff_id;

  const result = await patientService.getNurseCareTeamAssignments(nurseStaffId);

  messageSender(
    200,
    'Care team assignments retrieved successfully',
    result,
    res,
  );
});
