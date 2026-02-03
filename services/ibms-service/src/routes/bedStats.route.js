import express from 'express';
import BedStatsController from '../controllers/BedStats.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/beds/stats/overview
 * @desc    Get comprehensive bed statistics overview
 * @access  Admin, Nurse
 */
router.get('/overview', BedStatsController.getOverview);

/**
 * @route   GET /api/beds/stats/dashboard
 * @desc    Get comprehensive dashboard statistics (combines multiple stats)
 * @access  Admin
 */
router.get(
  '/dashboard',

  BedStatsController.getDashboardStats,
);

/**
 * @route   GET /api/beds/stats/occupancy-trends
 * @desc    Get bed occupancy trends over time
 * @access  Admin, Nurse
 * @query   startDate - Start date (optional, defaults to 30 days ago)
 * @query   endDate - End date (optional, defaults to today)
 */
router.get('/occupancy-trends', BedStatsController.getOccupancyTrends);

/**
 * @route   GET /api/beds/stats/department-utilization
 * @desc    Get department-wise bed utilization statistics
 * @access  Admin
 */
router.get(
  '/department-utilization',

  BedStatsController.getDepartmentUtilization,
);

/**
 * @route   GET /api/beds/stats/room-occupancy
 * @desc    Get detailed room occupancy information
 * @access  Admin, Nurse
 * @query   floor - Floor number filter (optional)
 */
router.get('/room-occupancy', BedStatsController.getRoomOccupancy);

/**
 * @route   GET /api/beds/stats/requiring-attention
 * @desc    Get beds requiring cleaning or maintenance with priority
 * @access  Admin, Nurse, Housekeeping
 */
router.get(
  '/requiring-attention',
  BedStatsController.getBedsRequiringAttention,
);

/**
 * @route   GET /api/beds/stats/admissions
 * @desc    Get admission statistics for a date range
 * @access  Admin
 * @query   startDate - Start date (optional, defaults to 30 days ago)
 * @query   endDate - End date (optional, defaults to today)
 */
router.get(
  '/admissions',

  BedStatsController.getAdmissionStats,
);

/**
 * @route   GET /api/beds/stats/current-assignments
 * @desc    Get all current bed assignments with patient details
 * @access  Admin, Nurse, Doctor
 * @query   floor - Floor number filter (optional)
 * @query   roomType - Room type filter (optional)
 * @query   bedType - Bed type filter (optional)
 */
router.get('/current-assignments', BedStatsController.getCurrentAssignments);

/**
 * @route   GET /api/beds/stats/turnover-rate
 * @desc    Get bed turnover rate statistics
 * @access  Admin
 * @query   startDate - Start date (optional, defaults to 30 days ago)
 * @query   endDate - End date (optional, defaults to today)
 */
router.get(
  '/turnover-rate',

  BedStatsController.getTurnoverRate,
);

export default router;
