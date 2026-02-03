import BedStatsService from '../services/BedStatsOverview.service.js';
import AppError from '../../../shared/utils/AppError.util.js';

class BedStatsController {
  /**
   * @route   GET /api/beds/stats/overview
   * @desc    Get comprehensive bed statistics overview
   * @access  Admin, Nurse
   */
  async getOverview(req, res, next) {
    try {
      const stats = await BedStatsService.getBedStatsOverview();

      res.status(200).json({
        success: true,
        message: 'Bed statistics overview retrieved successfully',
        data: stats,
      });
    } catch (error) {
      console.error('Get bed stats overview controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/occupancy-trends
   * @desc    Get bed occupancy trends for a date range
   * @access  Admin, Nurse
   */
  async getOccupancyTrends(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Validate dates
      if (start > end) {
        throw new AppError('Start date cannot be after end date', 400);
      }

      const trends = await BedStatsService.getBedOccupancyTrends(start, end);

      res.status(200).json({
        success: true,
        message: 'Bed occupancy trends retrieved successfully',
        data: {
          period: {
            start_date: start,
            end_date: end,
          },
          trends,
        },
      });
    } catch (error) {
      console.error('Get occupancy trends controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/department-utilization
   * @desc    Get department-wise bed utilization
   * @access  Admin
   */
  async getDepartmentUtilization(req, res, next) {
    try {
      const utilization = await BedStatsService.getDepartmentBedUtilization();

      res.status(200).json({
        success: true,
        message: 'Department bed utilization retrieved successfully',
        data: utilization,
      });
    } catch (error) {
      console.error('Get department utilization controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/room-occupancy
   * @desc    Get detailed room occupancy information
   * @access  Admin, Nurse
   */
  async getRoomOccupancy(req, res, next) {
    try {
      const { floor } = req.query;
      const floorNumber = floor ? parseInt(floor) : null;

      const rooms = await BedStatsService.getRoomOccupancyDetails(floorNumber);

      res.status(200).json({
        success: true,
        message: 'Room occupancy details retrieved successfully',
        data: {
          floor_number: floorNumber,
          total_rooms: rooms.length,
          rooms,
        },
      });
    } catch (error) {
      console.error('Get room occupancy controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/requiring-attention
   * @desc    Get beds that require cleaning or maintenance
   * @access  Admin, Nurse, Housekeeping
   */
  async getBedsRequiringAttention(req, res, next) {
    try {
      const beds = await BedStatsService.getBedsRequiringAttention();

      res.status(200).json({
        success: true,
        message: 'Beds requiring attention retrieved successfully',
        data: beds,
      });
    } catch (error) {
      console.error('Get beds requiring attention controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/admissions
   * @desc    Get admission statistics for a date range
   * @access  Admin
   */
  async getAdmissionStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (start > end) {
        throw new AppError('Start date cannot be after end date', 400);
      }

      const stats = await BedStatsService.getAdmissionStats(start, end);

      res.status(200).json({
        success: true,
        message: 'Admission statistics retrieved successfully',
        data: {
          period: {
            start_date: start,
            end_date: end,
          },
          statistics: stats,
        },
      });
    } catch (error) {
      console.error('Get admission stats controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/current-assignments
   * @desc    Get all current bed assignments with patient details
   * @access  Admin, Nurse, Doctor
   */
  async getCurrentAssignments(req, res, next) {
    try {
      const { floor, roomType, bedType } = req.query;

      const filters = {
        floorNumber: floor ? parseInt(floor) : null,
        roomType: roomType || null,
        bedType: bedType || null,
      };

      const assignments =
        await BedStatsService.getCurrentBedAssignments(filters);

      res.status(200).json({
        success: true,
        message: 'Current bed assignments retrieved successfully',
        data: {
          total_assignments: assignments.length,
          filters,
          assignments,
        },
      });
    } catch (error) {
      console.error('Get current assignments controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/turnover-rate
   * @desc    Get bed turnover rate for a period
   * @access  Admin
   */
  async getTurnoverRate(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (start > end) {
        throw new AppError('Start date cannot be after end date', 400);
      }

      const turnoverRate = await BedStatsService.getBedTurnoverRate(start, end);

      res.status(200).json({
        success: true,
        message: 'Bed turnover rate retrieved successfully',
        data: turnoverRate,
      });
    } catch (error) {
      console.error('Get turnover rate controller error:', error);
      next(error);
    }
  }

  /**
   * @route   GET /api/beds/stats/dashboard
   * @desc    Get comprehensive dashboard data (combines multiple stats)
   * @access  Admin
   */
  async getDashboardStats(req, res, next) {
    try {
      const { days = 30 } = req.query;

      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - parseInt(days) * 24 * 60 * 60 * 1000,
      );

      // Get all relevant statistics in parallel
      const [
        overview,
        trends,
        departmentUtilization,
        bedsRequiringAttention,
        turnoverRate,
        admissionStats,
      ] = await Promise.all([
        BedStatsService.getBedStatsOverview(),
        BedStatsService.getBedOccupancyTrends(startDate, endDate),
        BedStatsService.getDepartmentBedUtilization(),
        BedStatsService.getBedsRequiringAttention(),
        BedStatsService.getBedTurnoverRate(startDate, endDate),
        BedStatsService.getAdmissionStats(startDate, endDate),
      ]);

      res.status(200).json({
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: {
          period: {
            start_date: startDate,
            end_date: endDate,
            days: parseInt(days),
          },
          overview,
          occupancy_trends: trends,
          department_utilization: departmentUtilization,
          beds_requiring_attention: bedsRequiringAttention,
          turnover_rate: turnoverRate,
          admission_stats: admissionStats,
          generated_at: new Date(),
        },
      });
    } catch (error) {
      console.error('Get dashboard stats controller error:', error);
      next(error);
    }
  }
}

export default new BedStatsController();
