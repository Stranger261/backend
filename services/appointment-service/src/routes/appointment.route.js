import express from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// Appointment types
router.get('/appointment-types', appointmentController.appointmentTypes);

// Book new appointment (Patient or Receptionist)
router.post(
  '/book',
  [authenticate, authorizeRole('patient', 'receptionist', 'admin')],
  appointmentController.bookAppointment
);

// Get appointment by ID
router.get(
  '/:appointmentId',
  authenticate,
  appointmentController.getAppointmentById
);

// Get patient's appointments
router.get(
  '/patient/:patientUuid',
  authenticate,
  appointmentController.getPatientAppointments
);

// Calculate fee (before booking)
router.get('/calculate-fee', authenticate, appointmentController.calculateFee);

// ==================================================
// STAFF ROUTES
// ==================================================

// Get today's appointments (for doctors/receptionists)
router.get(
  '/today',
  [authenticate, authorizeRole('doctor', 'receptionist', 'admin')],
  appointmentController.getTodaysAppointments
);

// Check-in appointment (Receptionist)
router.patch(
  '/:appointmentId/check-in',
  [authenticate, authorizeRole('receptionist', 'admin')],
  appointmentController.checkInAppointment
);

// Cancel appointment (Patient, Receptionist, or Admin)
router.patch(
  '/:appointmentId/cancel',
  [authenticate, authorizeRole('patient', 'receptionist', 'admin')],
  appointmentController.cancelAppointment
);

// Reschedule appointment
router.patch(
  '/:appointmentId/reschedule',
  [authenticate, authorizeRole('patient', 'receptionist', 'admin')],
  appointmentController.rescheduleAppointment
);

// Extend appointment (Doctor only)
router.patch(
  '/:appointmentId/extend',
  [authenticate, authorizeRole('doctor', 'admin')],
  appointmentController.extendAppointment
);

// Complete appointment (Doctor only)
router.patch(
  '/:appointmentId/complete',
  [authenticate, authorizeRole('doctor', 'admin')],
  appointmentController.completeAppointment
);

// ==================================================
// PAYMENT ROUTES
// ==================================================

// Process payment (Receptionist/Admin)
router.post(
  '/:appointmentId/payment',
  [authenticate, authorizeRole('receptionist', 'admin')],
  appointmentController.processPayment
);

router.get('/calculate-fee', authenticate, appointmentController.calculateFee);

// ==================================================
// HISTORY ROUTES
// ==================================================

// Get appointment history (audit trail)
router.get(
  '/:appointmentId/history',
  [authenticate, authorizeRole('doctor', 'receptionist', 'admin')],
  appointmentController.getAppointmentHistory
);

export default router;
