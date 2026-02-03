import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import appointmentDiagnosisService from '../services/appointmentDiagnosis.service.js';

export const createDiagnosis = asyncHandler(async (req, res) => {
  const doctorStaffId = req?.user?.staff_id;
  const { diagnosisData } = req.body;

  const authToken = req.cookies?.jwt;

  const diagnosis = await appointmentDiagnosisService.createDiagnosis(
    diagnosisData,
    doctorStaffId,
    authToken,
  );

  messageSender(201, 'Diagnosis created successfully.', diagnosis, res);
});

export const updateDiagnosis = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const { diagnosisData } = req.body;

  const diagnosis = await appointmentDiagnosisService.updateDiagnosis(
    appointmentId,
    diagnosisData,
  );

  messageSender(200, 'Diagnosis updated successfully.', diagnosis, res);
});

export const getDiagnosisByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const diagnosis =
    await appointmentDiagnosisService.getDiagnosisByAppointment(appointmentId);

  messageSender(200, 'Diagnosis fetched successfully.', diagnosis, res);
});
