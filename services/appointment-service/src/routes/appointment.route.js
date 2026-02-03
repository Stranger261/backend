import express from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// ==================================================
// PUBLIC / SHARED ROUTES
// ==================================================

router.get('/appointment-types', appointmentController.appointmentTypes);

router.get('/calculate-fee', authenticate, appointmentController.calculateFee);

// ==================================================
// STAFF ROUTES
// ==================================================

router.get(
  '/slots/:date',
  authenticate,
  appointmentController.getAllSlotsForDate,
);

router.get(
  '/slots-summary',
  authenticate,
  appointmentController.getSlotsSummary,
);

router.get(
  '/date/:date',
  authenticate,
  appointmentController.getAppointmentsByDate,
);

router.get(
  '/statistics/daily',
  authenticate,
  appointmentController.getDailyStatistics,
);

router.get('/today', authenticate, appointmentController.getTodaysAppointments);

router.get(
  '/doctors/:doctorUuid/appointments',
  authenticate,
  authorizeRole('admin', 'doctor', 'receptionist'),
  appointmentController.getDoctorAppointments,
);

router.get(
  '/patient/:patientUuid',
  authenticate,
  appointmentController.getPatientAppointments,
);

// ==================================================
// BOOKING
// ==================================================

router.post(
  '/book',
  authenticate,
  authorizeRole('patient', 'receptionist', 'admin'),
  appointmentController.bookAppointment,
);

// ==================================================
// APPOINTMENT ACTIONS
// ==================================================

router.patch(
  '/:appointmentId/reschedule',
  authenticate,
  authorizeRole('patient', 'receptionist', 'admin'),
  appointmentController.rescheduleAppointment,
);

router.patch(
  '/:appointmentId/update-status',
  authenticate,
  authorizeRole('doctor', 'nurse', 'receptionist'),
  appointmentController.updateAppointmentStatus,
);

router.patch(
  '/:appointmentId/extend',
  authenticate,
  authorizeRole('doctor', 'admin'),
  appointmentController.extendAppointment,
);

router.patch(
  '/:appointmentId/complete',
  authenticate,
  authorizeRole('doctor', 'admin'),
  appointmentController.completeAppointment,
);

// ==================================================
// PAYMENT
// ==================================================

router.post(
  '/:appointmentId/payment',
  authenticate,
  authorizeRole('receptionist', 'admin'),
  appointmentController.processPayment,
);

// ==================================================
// HISTORY
// ==================================================

router.get(
  '/:appointmentId/history',
  authenticate,
  authorizeRole('doctor', 'receptionist', 'admin'),
  appointmentController.getAppointmentHistory,
);

// ==================================================
// GENERIC (LAST)
// ==================================================

router.get(
  '/:appointmentId',
  authenticate,
  appointmentController.getAppointmentById,
);

export default router;
