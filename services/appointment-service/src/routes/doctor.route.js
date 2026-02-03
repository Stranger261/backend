// routes/doctor.route.js

import express from 'express';
import * as doctorController from '../controllers/doctor.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// Get all departments
router.get('/departments', authenticate, doctorController.getDepartments);

// Get all doctors
router.get('/doctors', authenticate, doctorController.getAllDoctors);

// Get doctors by department (with recommendations for patients)
router.get(
  '/departments/:departmentId/doctors',
  authenticate,
  doctorController.getDoctorsByDepartment,
);

// Get doctor's availability (3-month schedule for booking)
router.get(
  '/doctors/:doctorUuid/availability',
  authenticate,
  doctorController.getDoctorAvailability,
);

// Get combined department availability (for "Any Doctor" option)
router.get(
  '/departments/:departmentId/availability',
  authenticate,
  doctorController.getDepartmentAvailability,
);

router.post('/', authenticate, doctorController.createDoctorSchedule);

export default router;
