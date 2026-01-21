import express from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// ==================================================
// STAFF ROUTES
// ==================================================

// Get doctor's appointments (for doctor/receptionist view)
router.get(
  '/doctors/:doctorUuid/appointments',
  authenticate,
  authorizeRole('admin', 'doctor', 'receptionist'),
  appointmentController.getDoctorAppointments,
);

// Get today's appointments (for doctors/receptionists)
router.get(
  '/today',
  [authenticate],
  appointmentController.getTodaysAppointments,
);

// Reschedule appointment
router.patch(
  '/:appointmentId/reschedule',
  [authenticate, authorizeRole('patient', 'receptionist', 'admin')],
  appointmentController.rescheduleAppointment,
);

router.patch('/:appointmentId/update-status', [
  authenticate,
  authorizeRole('doctor', 'nurse', 'receptionist'),
  appointmentController.updateAppointmentStatus,
]);

// Extend appointment (Doctor only)
router.patch(
  '/:appointmentId/extend',
  [authenticate, authorizeRole('doctor', 'admin')],
  appointmentController.extendAppointment,
);

// Complete appointment (Doctor only)
router.patch(
  '/:appointmentId/complete',
  [authenticate, authorizeRole('doctor', 'admin')],
  appointmentController.completeAppointment,
);

// ==================================================
// Public ROUTES
// ==================================================

// Appointment types
router.get('/appointment-types', appointmentController.appointmentTypes);

// Book new appointment (Patient or Receptionist)
router.post(
  '/book',
  [authenticate, authorizeRole('patient', 'receptionist', 'admin')],
  appointmentController.bookAppointment,
);

// Get appointment by ID
router.get(
  '/:appointmentId',
  authenticate,
  appointmentController.getAppointmentById,
);

// Get patient's appointments
router.get(
  '/patient/:patientUuid',
  authenticate,
  appointmentController.getPatientAppointments,
);

// Calculate fee (before booking)
router.get('/calculate-fee', authenticate, appointmentController.calculateFee);

// ==================================================
// PAYMENT ROUTES
// ==================================================

// Process payment (Receptionist/Admin)
router.post(
  '/:appointmentId/payment',
  [authenticate, authorizeRole('receptionist', 'admin')],
  appointmentController.processPayment,
);

router.get('/calculate-fee', authenticate, appointmentController.calculateFee);

// ==================================================
// HISTORY ROUTES
// ==================================================

// Get appointment history (audit trail)
router.get(
  '/:appointmentId/history',
  [authenticate, authorizeRole('doctor', 'receptionist', 'admin')],
  appointmentController.getAppointmentHistory,
);

export default router;
