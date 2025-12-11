// routes/doctor.route.js
/**
 * Doctor Routes (Core 1 - Appointment System)
 * READ-ONLY routes for appointment booking
 * No schedule/leave management (that's HR module)
 */

import express from 'express';
import * as doctorController from '../controllers/doctor.controller.js';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// Get all departments
router.get('/departments', authenticate, doctorController.getDepartments);

// Get all doctors
router.get('/doctors', authenticate, doctorController.getAllDoctors);

// Get doctors by department (with recommendations for patients)
router.get(
  '/departments/:departmentId/doctors',
  authenticate,
  doctorController.getDoctorsByDepartment
);

// Get doctor's availability (3-month schedule for booking)
router.get(
  '/doctors/:doctorUuid/availability',
  authenticate,
  doctorController.getDoctorAvailability
);

// Get combined department availability (for "Any Doctor" option)
router.get(
  '/departments/:departmentId/availability',
  authenticate,
  doctorController.getDepartmentAvailability
);

// Get doctor's appointments (for doctor/receptionist view)
router.get(
  '/doctors/:doctorUuid/appointments',
  authenticate,
  authorizeRole('admin', 'doctor', 'receptionist'),
  doctorController.getDoctorAppointments
);

export default router;
