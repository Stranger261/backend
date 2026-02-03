// services/dashboard/CensusService.js
import { Op, Sequelize } from 'sequelize';
import {
  Admission,
  ERVisit,
  Bed,
  BedAssignment,
  AdmissionProgressNote,
  PatientConsent,
  PHIAccessLog,
  AuditLog,
  Department,
  Room,
  Staff,
} from '../../../shared/models/index.js';

class CensusService {
  /**
   * Get real-time patient distribution by department/ward
   */
  static async getPatientDistribution() {
    // Get all active admissions with their bed assignments
    const admissions = await Admission.findAll({
      where: { admission_status: 'active' },
      include: [
        {
          association: 'bedAssignments',
          where: { is_current: true },
          required: false,
          include: [
            {
              association: 'bed',
              include: [
                {
                  association: 'room',
                  include: ['department'],
                },
              ],
            },
          ],
        },
        {
          association: 'patient',
          include: ['person'],
        },
      ],
    });

    // Group by department
    const distribution = {};

    admissions.forEach(admission => {
      const department = admission.bedAssignments?.[0]?.bed?.room?.department;

      if (department) {
        const deptId = department.department_id;

        if (!distribution[deptId]) {
          distribution[deptId] = {
            department_id: deptId,
            department_name: department.department_name,
            department_code: department.department_code,
            patient_count: 0,
            patients: [],
          };
        }

        distribution[deptId].patient_count++;
        distribution[deptId].patients.push({
          admission_id: admission.admission_id,
          patient_name: admission.patient?.person?.full_name || 'Unknown',
          mrn: admission.patient?.mrn,
          bed_number: admission.bedAssignments?.[0]?.bed?.bed_number,
          room_number: admission.bedAssignments?.[0]?.bed?.room?.room_number,
          admission_date: admission.admission_date,
        });
      }
    });

    // Convert to array and sort by patient count
    return Object.values(distribution).sort(
      (a, b) => b.patient_count - a.patient_count,
    );
  }

  /**
   * Get current bed occupancy by room type
   */
  static async getBedOccupancyByRoomType() {
    // Get all rooms with beds
    const rooms = await Room.findAll({
      include: [
        {
          association: 'beds',
          attributes: ['bed_id', 'bed_status', 'bed_type'],
        },
      ],
    });

    // Group by room type
    const occupancyByType = {};

    rooms.forEach(room => {
      const roomType = room.room_type;

      if (!occupancyByType[roomType]) {
        occupancyByType[roomType] = {
          room_type: roomType,
          total_beds: 0,
          occupied_beds: 0,
          available_beds: 0,
          maintenance_beds: 0,
          rooms: [],
        };
      }

      const typeStats = occupancyByType[roomType];
      const beds = room.beds || [];

      typeStats.total_beds += beds.length;
      typeStats.occupied_beds += beds.filter(
        b => b.bed_status === 'occupied',
      ).length;
      typeStats.available_beds += beds.filter(
        b => b.bed_status === 'available',
      ).length;
      typeStats.maintenance_beds += beds.filter(
        b => b.bed_status === 'maintenance',
      ).length;

      typeStats.rooms.push({
        room_id: room.room_id,
        room_number: room.room_number,
        floor_number: room.floor_number,
        bed_statuses: beds.map(b => b.bed_status),
      });
    });

    // Add percentage calculations
    return Object.values(occupancyByType).map(stats => ({
      ...stats,
      occupancy_rate:
        stats.total_beds > 0
          ? Math.round((stats.occupied_beds / stats.total_beds) * 100)
          : 0,
      availability_rate:
        stats.total_beds > 0
          ? Math.round((stats.available_beds / stats.total_beds) * 100)
          : 0,
    }));
  }

  /**
   * Get staff-to-patient ratios
   */
  static async getStaffPatientRatios() {
    // Get active staff count by role
    const staffByRole = await Staff.findAll({
      where: { employment_status: 'active' },
      attributes: [
        'role',
        [Sequelize.fn('COUNT', Sequelize.col('staff_id')), 'count'],
      ],
      group: ['role'],
    });

    // Get current patient count
    const patientCount = await Admission.count({
      where: { admission_status: 'active' },
    });

    // Calculate ratios
    const ratios = staffByRole.map(staff => {
      const role = staff.role;
      const staffCount = parseInt(staff.dataValues.count);
      let ratio = staffCount > 0 ? Math.round(patientCount / staffCount) : 0;

      // Adjust ratios based on role (doctors handle fewer patients than nurses)
      if (role === 'doctor') {
        ratio = staffCount > 0 ? Math.round(patientCount / staffCount) : 0;
      } else if (role === 'nurse') {
        ratio = staffCount > 0 ? Math.round(patientCount / staffCount / 2) : 0; // Nurses handle more patients
      }

      return {
        role: role,
        staff_count: staffCount,
        patient_count: patientCount,
        patient_to_staff_ratio: ratio,
        status: this.getRatioStatus(role, ratio),
      };
    });

    return {
      total_patients: patientCount,
      total_staff: staffByRole.reduce(
        (sum, staff) => sum + parseInt(staff.dataValues.count),
        0,
      ),
      overall_ratio:
        patientCount > 0 ? Math.round(patientCount / staffByRole.length) : 0,
      by_role: ratios,
    };
  }

  static getRatioStatus(role, ratio) {
    const thresholds = {
      doctor: { good: 8, warning: 12, critical: 15 },
      nurse: { good: 4, warning: 6, critical: 8 },
      default: { good: 10, warning: 15, critical: 20 },
    };

    const threshold = thresholds[role] || thresholds.default;

    if (ratio <= threshold.good) return 'good';
    if (ratio <= threshold.warning) return 'warning';
    return 'critical';
  }

  /**
   * Get admission/discharge trends
   */
  static async getAdmissionDischargeTrends(days = 30) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Daily admission counts
    const dailyAdmissions = await Admission.findAll({
      where: {
        admission_date: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('admission_date')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('admission_id')), 'admissions'],
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('admission_date'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('admission_date')), 'ASC']],
      raw: true,
    });

    // Daily discharge counts
    const dailyDischarges = await Admission.findAll({
      where: {
        discharge_date: { [Op.between]: [startDate, endDate] },
        admission_status: 'discharged',
      },
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('discharge_date')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('admission_id')), 'discharges'],
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('discharge_date'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('discharge_date')), 'ASC']],
      raw: true,
    });

    // Combine data
    const dateMap = new Map();

    // Initialize all dates in range
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split('T')[0];
      dateMap.set(dateStr, {
        date: dateStr,
        admissions: 0,
        discharges: 0,
        net_change: 0,
      });
    }

    // Add admissions
    dailyAdmissions.forEach(item => {
      const dateStr = new Date(item.date).toISOString().split('T')[0];
      if (dateMap.has(dateStr)) {
        dateMap.get(dateStr).admissions = parseInt(item.admissions);
      }
    });

    // Add discharges
    dailyDischarges.forEach(item => {
      const dateStr = new Date(item.date).toISOString().split('T')[0];
      if (dateMap.has(dateStr)) {
        dateMap.get(dateStr).discharges = parseInt(item.discharges);
        dateMap.get(dateStr).net_change =
          dateMap.get(dateStr).admissions - dateMap.get(dateStr).discharges;
      }
    });

    // Calculate cumulative occupancy
    let cumulativeOccupancy = 0;
    const trends = Array.from(dateMap.values()).map(day => {
      cumulativeOccupancy += day.net_change;
      return {
        ...day,
        cumulative_occupancy: cumulativeOccupancy,
      };
    });

    // Summary statistics
    const summary = {
      total_admissions: trends.reduce((sum, day) => sum + day.admissions, 0),
      total_discharges: trends.reduce((sum, day) => sum + day.discharges, 0),
      average_daily_admissions: Math.round(
        trends.reduce((sum, day) => sum + day.admissions, 0) / trends.length,
      ),
      average_daily_discharges: Math.round(
        trends.reduce((sum, day) => sum + day.discharges, 0) / trends.length,
      ),
      peak_admissions_day: trends.reduce(
        (max, day) => (day.admissions > max.admissions ? day : max),
        { admissions: 0, date: '' },
      ),
      peak_discharges_day: trends.reduce(
        (max, day) => (day.discharges > max.discharges ? day : max),
        { discharges: 0, date: '' },
      ),
    };

    return {
      period_days: days,
      start_date: startDate,
      end_date: endDate,
      daily_trends: trends,
      summary: summary,
    };
  }

  /**
   * Get complete census data
   */
  static async getHospitalCensus() {
    try {
      const [patientDistribution, bedOccupancy, staffRatios, admissionTrends] =
        await Promise.all([
          this.getPatientDistribution(),
          this.getBedOccupancyByRoomType(),
          this.getStaffPatientRatios(),
          this.getAdmissionDischargeTrends(30),
        ]);

      return {
        patient_distribution: patientDistribution,
        bed_occupancy: bedOccupancy,
        staff_patient_ratios: staffRatios,
        admission_discharge_trends: admissionTrends,
        last_updated: new Date(),
      };
    } catch (error) {
      console.error('Error in getHospitalCensus:', error);
      throw error;
    }
  }
}

export default CensusService;
