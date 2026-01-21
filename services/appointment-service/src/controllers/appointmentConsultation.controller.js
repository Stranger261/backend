import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import appointmentConsultationService from '../services/appointmentConsultation.service.js';

export const getCompleteConsultation = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const consultation =
    await appointmentConsultationService.getCompleteConsultation(appointmentId);

  messageSender(
    200,
    'Consultation data fetched successfully.',
    consultation,
    res,
  );
});

export const getPatientConsultationHistory = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { limit } = req.query;

  const history =
    await appointmentConsultationService.getPatientConsultationHistory(
      patientId,
      limit ? parseInt(limit) : 20,
    );

  messageSender(
    200,
    'Consultation history fetched successfully.',
    history,
    res,
  );
});

export const startConsultation = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const doctorStaffId = req.staff.staff_id;

  const consultation = await appointmentConsultationService.startConsultation(
    appointmentId,
    doctorStaffId,
  );

  messageSender(200, 'Consultation started successfully.', consultation, res);
});

export const completeConsultation = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const doctorStaffId = req.staff.staff_id;
  const consultationData = req.body;

  const consultation =
    await appointmentConsultationService.completeConsultation(
      appointmentId,
      consultationData,
      doctorStaffId,
    );

  messageSender(200, 'Consultation completed successfully.', consultation, res);
});
