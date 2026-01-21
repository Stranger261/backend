// routes/dashboard.routes.js
import express from 'express';
import {
  getDashboardStats,
  getPatientUpcomingAppointments,
} from '../controllers/dashboard.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats', authenticate, getDashboardStats);

router.get('/upcoming', authenticate, getPatientUpcomingAppointments);

export default router;
