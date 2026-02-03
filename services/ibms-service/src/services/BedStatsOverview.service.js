// BedStatsService.js - Complete Service with All Required Methods

import { Op } from 'sequelize';
import sequelize from '../../../shared/config/db.config.js';
import Admission from '../../../shared/models/ibms/Admission.model.js';
import Staff from '../../../shared/models/ibms/Staff.model.js';
import Department from '../../../shared/models/ibms/Department.model.js';
import Bed from '../../../shared/models/ibms/Bed.model.js';
import Room from '../../../shared/models/ibms/Room.model.js';
import BedAssignment from '../../../shared/models/ibms/BedAssignment.model.js';
import Patient from '../../../shared/models/patient/Patient.model.js';
import AppError from '../../../shared/utils/AppError.util.js';

class BedStatsService {
  /**
   * Get comprehensive bed statistics overview
   */
  async getBedStatsOverview() {
    try {
      const overview = await sequelize.query(
        `
        SELECT 
          COUNT(b.bed_id) as total_beds,
          SUM(CASE WHEN ba.assignment_status = 'active' THEN 1 ELSE 0 END) as occupied_beds,
          SUM(CASE WHEN ba.assignment_status IS NULL OR ba.assignment_status != 'active' THEN 1 ELSE 0 END) as available_beds,
          SUM(CASE WHEN b.status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_beds,
          SUM(CASE WHEN b.status = 'cleaning' THEN 1 ELSE 0 END) as cleaning_beds,
          ROUND(
            (SUM(CASE WHEN ba.assignment_status = 'active' THEN 1 ELSE 0 END) / COUNT(b.bed_id)) * 100, 
            2
          ) as occupancy_rate
        FROM beds b
        LEFT JOIN bed_assignments ba ON ba.bed_id = b.bed_id AND ba.assignment_status = 'active'
        `,
        {
          type: sequelize.QueryTypes.SELECT,
        },
      );

      // Get department breakdown
      const departments = await sequelize.query(
        `
        SELECT 
          d.department_id,
          d.department_name as name,
          COUNT(b.bed_id) as total_beds,
          SUM(CASE WHEN ba.assignment_status = 'active' THEN 1 ELSE 0 END) as occupied_beds
        FROM departments d
        LEFT JOIN beds b ON b.department_id = d.department_id
        LEFT JOIN bed_assignments ba ON ba.bed_id = b.bed_id AND ba.assignment_status = 'active'
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
        `,
        {
          type: sequelize.QueryTypes.SELECT,
        },
      );

      return {
        total_beds: parseInt(overview[0].total_beds || 0),
        occupied_beds: parseInt(overview[0].occupied_beds || 0),
        available_beds: parseInt(overview[0].available_beds || 0),
        maintenance_beds: parseInt(overview[0].maintenance_beds || 0),
        cleaning_beds: parseInt(overview[0].cleaning_beds || 0),
        occupancy_rate: parseFloat(overview[0].occupancy_rate || 0),
        departments: departments.map(d => ({
          department_id: d.department_id,
          name: d.name,
          total_beds: parseInt(d.total_beds || 0),
          occupied_beds: parseInt(d.occupied_beds || 0),
        })),
      };
    } catch (error) {
      console.error('Get bed stats overview failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed statistics overview.', 500);
    }
  }

  /**
   * Get bed occupancy trends over time
   */
  async getBedOccupancyTrends(startDate, endDate) {
    try {
      const trends = await sequelize.query(
        `
        SELECT 
          DATE(ba.assigned_at) as date,
          COUNT(DISTINCT ba.bed_id) as occupied_beds,
          (SELECT COUNT(*) FROM beds) as total_beds,
          ROUND(
            (COUNT(DISTINCT ba.bed_id) / (SELECT COUNT(*) FROM beds)) * 100,
            2
          ) as occupancy_rate
        FROM bed_assignments ba
        WHERE ba.assigned_at BETWEEN :startDate AND :endDate
          AND ba.assignment_status = 'active'
        GROUP BY DATE(ba.assigned_at)
        ORDER BY date ASC
        `,
        {
          replacements: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      return trends.map(t => ({
        date: t.date,
        occupied_beds: parseInt(t.occupied_beds || 0),
        total_beds: parseInt(t.total_beds || 0),
        occupancy_rate: parseFloat(t.occupancy_rate || 0),
      }));
    } catch (error) {
      console.error('Get bed occupancy trends failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed occupancy trends.', 500);
    }
  }

  /**
   * Get department-wise bed utilization
   */
  async getDepartmentBedUtilization() {
    try {
      const utilization = await sequelize.query(
        `
        SELECT 
          d.department_id,
          d.department_name,
          COUNT(DISTINCT a.admission_id) as total_admissions,
          AVG(a.length_of_stay_days) as avg_length_of_stay,
          SUM(CASE WHEN a.admission_status = 'admitted' THEN 1 ELSE 0 END) as currently_admitted,
          COUNT(DISTINCT b.bed_id) as total_beds,
          COUNT(DISTINCT CASE WHEN ba.assignment_status = 'active' THEN ba.bed_id END) as occupied_beds
        FROM departments d
        LEFT JOIN staff s ON s.department_id = d.department_id
        LEFT JOIN admissions a ON a.attending_doctor_id = s.staff_id 
          AND a.admission_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        LEFT JOIN beds b ON b.department_id = d.department_id
        LEFT JOIN bed_assignments ba ON ba.bed_id = b.bed_id 
          AND ba.assignment_status = 'active'
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
        `,
        {
          type: sequelize.QueryTypes.SELECT,
        },
      );

      return utilization.map(u => ({
        department_id: u.department_id,
        department_name: u.department_name,
        total_admissions: parseInt(u.total_admissions || 0),
        currently_admitted: parseInt(u.currently_admitted || 0),
        avg_length_of_stay: parseFloat(u.avg_length_of_stay || 0),
        total_beds: parseInt(u.total_beds || 0),
        occupied_beds: parseInt(u.occupied_beds || 0),
        occupancy_rate:
          u.total_beds > 0
            ? parseFloat(((u.occupied_beds / u.total_beds) * 100).toFixed(2))
            : 0,
        turnover_rate:
          u.total_admissions > 0 && u.total_beds > 0
            ? parseFloat((u.total_admissions / u.total_beds / 30).toFixed(2))
            : 0,
      }));
    } catch (error) {
      console.error('Get department bed utilization failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get department bed utilization.', 500);
    }
  }

  /**
   * Get detailed room occupancy information
   */
  async getRoomOccupancyDetails(floorNumber = null) {
    try {
      const whereClause = floorNumber ? 'WHERE r.floor = :floorNumber' : '';

      const rooms = await sequelize.query(
        `
        SELECT 
          r.room_id,
          r.room_number,
          r.floor,
          r.room_type,
          d.department_name,
          COUNT(b.bed_id) as total_beds,
          COUNT(CASE WHEN ba.assignment_status = 'active' THEN 1 END) as occupied_beds,
          COUNT(CASE WHEN ba.assignment_status IS NULL OR ba.assignment_status != 'active' THEN 1 END) as available_beds
        FROM rooms r
        INNER JOIN departments d ON d.department_id = r.department_id
        LEFT JOIN beds b ON b.room_id = r.room_id
        LEFT JOIN bed_assignments ba ON ba.bed_id = b.bed_id AND ba.assignment_status = 'active'
        ${whereClause}
        GROUP BY r.room_id, r.room_number, r.floor, r.room_type, d.department_name
        ORDER BY r.floor, r.room_number
        `,
        {
          replacements: floorNumber ? { floorNumber } : {},
          type: sequelize.QueryTypes.SELECT,
        },
      );

      return rooms.map(room => ({
        room_id: room.room_id,
        room_number: room.room_number,
        floor: room.floor,
        room_type: room.room_type,
        department_name: room.department_name,
        total_beds: parseInt(room.total_beds || 0),
        occupied_beds: parseInt(room.occupied_beds || 0),
        available_beds: parseInt(room.available_beds || 0),
        occupancy_rate:
          room.total_beds > 0
            ? parseFloat(
                ((room.occupied_beds / room.total_beds) * 100).toFixed(2),
              )
            : 0,
      }));
    } catch (error) {
      console.error('Get room occupancy details failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get room occupancy details.', 500);
    }
  }

  /**
   * Get beds requiring attention (cleaning or maintenance)
   */
  async getBedsRequiringAttention() {
    try {
      const beds = await sequelize.query(
        `
        SELECT 
          b.bed_id,
          b.bed_number,
          b.room_id,
          r.room_number,
          r.floor,
          d.department_name as department,
          'maintenance' as issue_type,
          'high' as priority,
          NOW() as reported_at,
          'Needs maintenance' as description
        FROM beds b
        INNER JOIN rooms r ON r.room_id = b.room_id
        INNER JOIN departments d ON d.department_id = r.department_id
        WHERE b.status = 'maintenance'
        
        UNION ALL
        
        SELECT 
          b.bed_id,
          b.bed_number,
          b.room_id,
          r.room_number,
          r.floor,
          d.department_name as department,
          'cleaning' as issue_type,
          'medium' as priority,
          NOW() as reported_at,
          'Needs cleaning' as description
        FROM beds b
        INNER JOIN rooms r ON r.room_id = b.room_id
        INNER JOIN departments d ON d.department_id = r.department_id
        WHERE b.status = 'cleaning'
        
        ORDER BY priority DESC, reported_at ASC
        `,
        {
          type: sequelize.QueryTypes.SELECT,
        },
      );

      return beds;
    } catch (error) {
      console.error('Get beds requiring attention failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get beds requiring attention.', 500);
    }
  }

  /**
   * Get admission statistics for a date range
   */
  async getAdmissionStats(startDate, endDate) {
    try {
      // Total admissions
      const total = await sequelize.query(
        `
        SELECT COUNT(*) as total_admissions
        FROM admissions
        WHERE admission_date BETWEEN :startDate AND :endDate
        `,
        {
          replacements: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      // By department
      const byDepartment = await sequelize.query(
        `
        SELECT 
          d.department_name,
          COUNT(a.admission_id) as admissions
        FROM departments d
        LEFT JOIN staff s ON s.department_id = d.department_id
        LEFT JOIN admissions a ON a.attending_doctor_id = s.staff_id
          AND a.admission_date BETWEEN :startDate AND :endDate
        GROUP BY d.department_name
        ORDER BY admissions DESC
        `,
        {
          replacements: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      // Daily trend
      const trend = await sequelize.query(
        `
        SELECT 
          DATE(admission_date) as date,
          COUNT(*) as admissions
        FROM admissions
        WHERE admission_date BETWEEN :startDate AND :endDate
        GROUP BY DATE(admission_date)
        ORDER BY date ASC
        `,
        {
          replacements: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      const totalAdmissions = parseInt(total[0].total_admissions || 0);
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      return {
        total_admissions: totalAdmissions,
        daily_average:
          days > 0 ? parseFloat((totalAdmissions / days).toFixed(2)) : 0,
        by_department: byDepartment.map(d => ({
          department_name: d.department_name,
          admissions: parseInt(d.admissions || 0),
        })),
        trend: trend.map(t => ({
          date: t.date,
          admissions: parseInt(t.admissions || 0),
        })),
      };
    } catch (error) {
      console.error('Get admission stats failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get admission statistics.', 500);
    }
  }

  /**
   * Get all current bed assignments with patient details
   */
  async getCurrentBedAssignments(filters = {}) {
    try {
      let whereConditions = [];
      let replacements = {};

      if (filters.floorNumber) {
        whereConditions.push('r.floor = :floorNumber');
        replacements.floorNumber = filters.floorNumber;
      }

      if (filters.roomType) {
        whereConditions.push('r.room_type = :roomType');
        replacements.roomType = filters.roomType;
      }

      if (filters.bedType) {
        whereConditions.push('b.bed_type = :bedType');
        replacements.bedType = filters.bedType;
      }

      const whereClause =
        whereConditions.length > 0
          ? `AND ${whereConditions.join(' AND ')}`
          : '';

      const assignments = await sequelize.query(
        `
        SELECT 
          ba.assignment_id,
          ba.patient_id,
          CONCAT(per.first_name, ' ', per.last_name) as patient_name,
          b.bed_number,
          r.room_number,
          r.floor,
          r.room_type,
          d.department_name as department,
          b.bed_type,
          a.admission_date,
          a.expected_discharge_date as expected_discharge,
          CONCAT(s_per.first_name, ' ', s_per.last_name) as attending_doctor,
          ba.assignment_status as status,
          ba.assigned_at
        FROM bed_assignments ba
        INNER JOIN beds b ON b.bed_id = ba.bed_id
        INNER JOIN rooms r ON r.room_id = b.room_id
        INNER JOIN departments d ON d.department_id = r.department_id
        INNER JOIN patients p ON p.patient_id = ba.patient_id
        INNER JOIN persons per ON per.person_id = p.person_id
        LEFT JOIN admissions a ON a.patient_id = ba.patient_id AND a.admission_status = 'admitted'
        LEFT JOIN staff s ON s.staff_id = a.attending_doctor_id
        LEFT JOIN persons s_per ON s_per.person_id = s.person_id
        WHERE ba.assignment_status = 'active'
        ${whereClause}
        ORDER BY r.floor, r.room_number, b.bed_number
        `,
        {
          replacements,
          type: sequelize.QueryTypes.SELECT,
        },
      );

      return assignments;
    } catch (error) {
      console.error('Get current bed assignments failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get current bed assignments.', 500);
    }
  }

  /**
   * Get bed turnover rate for a period
   */
  async getBedTurnoverRate(startDate, endDate) {
    try {
      const stats = await sequelize.query(
        `
        SELECT 
          COUNT(DISTINCT ba.bed_id) as beds_used,
          COUNT(ba.assignment_id) as total_discharges,
          (SELECT COUNT(*) FROM beds) as total_beds,
          DATEDIFF(:endDate, :startDate) as days
        FROM bed_assignments ba
        WHERE ba.discharged_at BETWEEN :startDate AND :endDate
        `,
        {
          replacements: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      const result = stats[0];
      const totalBeds = parseInt(result.total_beds || 0);
      const totalDischarges = parseInt(result.total_discharges || 0);
      const days = parseInt(result.days || 1);

      return {
        total_discharges: totalDischarges,
        average_beds: totalBeds,
        days: days,
        overall_rate:
          totalBeds > 0 && days > 0
            ? parseFloat((totalDischarges / totalBeds / days).toFixed(2))
            : 0,
      };
    } catch (error) {
      console.error('Get bed turnover rate failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed turnover rate.', 500);
    }
  }
}

export default new BedStatsService();
