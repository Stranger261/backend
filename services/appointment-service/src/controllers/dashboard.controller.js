// controllers/dashboard.controller.js
import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import DashboardService from '../services/dashboard.service.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const userRole = req.user.role;
  let userUuid = req.query.user_uuid || req.user?.user_uuid;

  if (!userUuid) {
    userUuid =
      userRole === 'patient' ? req.user?.patient_uuid : req.user?.staff_uuid;
  }

  if (!userUuid) {
    return messageSender(400, 'User UUID is required', null, res);
  }

  const stats = await DashboardService.getDashboardStats(userRole, userUuid);

  messageSender(200, 'Fetched successfully.', stats, res);
});

export const getPatientUpcomingAppointments = asyncHandler(async (req, res) => {
  const patientUuid = req.user.patient_uuid;

  const appt =
    await DashboardService.getPatientUpcomingAppointments(patientUuid);

  messageSender(200, 'Success.', appt, res);
});
