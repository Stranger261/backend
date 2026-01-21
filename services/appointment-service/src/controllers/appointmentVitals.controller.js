import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import appointmentVitalsService from '../services/appointmentVitals.service.js';

export const createVitals = asyncHandler(async (req, res) => {
  const nurseStaffId = req.user?.staff_id; // From authentication middleware
  const { vitalsData } = req.body;

  const vitals = await appointmentVitalsService.createVitals(
    vitalsData,
    nurseStaffId,
  );

  messageSender(201, 'Vitals recorded successfully.', vitals, res);
});

export const updateVitals = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const vitalsData = req.body;

  const vitals = await appointmentVitalsService.updateVitals(
    appointmentId,
    vitalsData,
  );

  messageSender(200, 'Vitals updated successfully.', vitals, res);
});

export const getVitalsByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const vitals =
    await appointmentVitalsService.getVitalsByAppointment(appointmentId);

  messageSender(200, 'Vitals fetched successfully.', vitals, res);
});

export const getPatientVitalsHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { limit } = req.query;

  const vitals = await appointmentVitalsService.getVitalsByPatient(
    patientId,
    limit ? parseInt(limit) : 10,
  );

  messageSender(200, 'Vitals history fetched successfully.', vitals, res);
});
