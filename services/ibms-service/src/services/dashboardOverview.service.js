// services/dashboard/OverviewService.js
import { Op, Sequelize } from 'sequelize';

import {
  Admission,
  ERVisit,
  Bed,
  AdmissionProgressNote,
  PatientConsent,
  PHIAccessLog,
  AuditLog,
  Department,
  Room,
} from '../../../shared/models/index.js';

class OverviewService {
  /**
   * Get live stats for dashboard overview
   */
  static async getLiveStats() {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    // 1. Inpatients count
    const inpatientCount = await Admission.count({
      where: { admission_status: 'active' },
    });

    // 2. ER waiting count (triage level 1-3)
    const erWaitingCount = await ERVisit.count({
      where: {
        er_status: 'waiting',
        triage_level: { [Op.in]: [1, 2, 3] },
      },
    });

    // 3. Today's appointments count
    const appointmentsCount = await Appointment.count({
      where: {
        appointment_date: {
          [Op.between]: [todayStart, todayEnd],
        },
        status: {
          [Op.in]: ['scheduled', 'confirmed', 'checked_in', 'in_progress'],
        },
      },
    });

    // 4. Bed occupancy percentage
    const totalBeds = await Bed.count();
    const occupiedBeds = await Bed.count({
      where: { bed_status: 'occupied' },
    });
    const bedOccupancy =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      inpatients: inpatientCount,
      er_waiting: erWaitingCount,
      appointments: appointmentsCount,
      bed_occupancy: bedOccupancy,
      total_beds: totalBeds,
      occupied_beds: occupiedBeds,
      updated_at: new Date(),
    };
  }

  /**
   * Get critical alerts panel
   */
  static async getCriticalAlerts() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 1. Critical progress notes (last 24 hours)
    const criticalNotes = await AdmissionProgressNote.findAll({
      where: {
        is_critical: true,
        note_date: { [Op.gte]: oneHourAgo },
        is_deleted: false,
      },
      include: [
        {
          association: 'admission',
          include: ['patient'],
        },
      ],
      limit: 10,
      order: [['note_date', 'DESC']],
    });

    // 2. High triage ER patients (level 1)
    const highTriagePatients = await ERVisit.findAll({
      where: {
        triage_level: 1,
        er_status: { [Op.in]: ['waiting', 'in_treatment'] },
      },
      include: ['patient'],
      order: [['arrival_time', 'ASC']],
      limit: 10,
    });

    // 3. Expiring consents (within 7 days)
    const expiringConsents = await PatientConsent.findAll({
      where: {
        consent_status: 'active',
        expiry_date: {
          [Op.between]: [
            new Date(),
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ],
        },
      },
      include: ['patient'],
      order: [['expiry_date', 'ASC']],
      limit: 10,
    });

    return {
      critical_notes: criticalNotes.map(note => ({
        id: note.note_id,
        type: 'critical_note',
        patient_name: note.admission?.patient?.person?.full_name || 'Unknown',
        note_type: note.note_type,
        note_date: note.note_date,
        severity: 'high',
      })),
      high_triage: highTriagePatients.map(er => ({
        id: er.er_visit_id,
        type: 'high_triage',
        patient_name: er.patient?.person?.full_name || 'Unknown',
        triage_level: er.triage_level,
        waiting_time: Math.floor((new Date() - er.arrival_time) / (1000 * 60)), // minutes
        severity: er.triage_level === 1 ? 'critical' : 'high',
      })),
      expiring_consents: expiringConsents.map(consent => ({
        id: consent.consent_id,
        type: 'expiring_consent',
        patient_name: consent.patient?.person?.full_name || 'Unknown',
        consent_type: consent.consent_type,
        expires_in: Math.ceil(
          (consent.expiry_date - new Date()) / (1000 * 60 * 60 * 24),
        ), // days
        severity: 'medium',
      })),
    };
  }

  /**
   * Get activity timeline (last 24 hours)
   */
  static async getActivityTimeline() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. PHI Access Log (last 24 hours)
    const phiAccess = await PHIAccessLog.findAll({
      where: {
        accessed_at: { [Op.gte]: oneDayAgo },
      },
      include: [
        {
          association: 'patient',
          include: ['person'],
        },
      ],
      order: [['accessed_at', 'DESC']],
      limit: 20,
    });

    // 2. System changes from audit log
    const systemChanges = await AuditLog.findAll({
      where: {
        created_at: { [Op.gte]: oneDayAgo },
        action_type: { [Op.in]: ['create', 'update', 'delete'] },
      },
      order: [['created_at', 'DESC']],
      limit: 20,
    });

    // Combine and sort by timestamp
    const activities = [
      ...phiAccess.map(access => ({
        id: access.access_id,
        type: 'phi_access',
        timestamp: access.accessed_at,
        user_id: access.user_id,
        action: access.access_type,
        resource: access.resource_type,
        patient_name: access.patient?.person?.full_name || 'Unknown',
        description: `${access.access_type} ${access.resource_type}`,
      })),
      ...systemChanges.map(change => ({
        id: change.audit_id,
        type: 'system_change',
        timestamp: change.created_at,
        user_id: change.user_id,
        action: change.action_type,
        resource: change.table_name,
        description: `${change.action_type} on ${change.table_name}`,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 30); // Show only last 30 activities

    return activities;
  }

  /**
   * Get performance charts data
   */
  static async getPerformanceCharts() {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    // 1. Hourly patient volume (for last 24 hours)
    const hourlyVolume = await this.getHourlyPatientVolume(24);

    // 2. Department utilization
    const departmentUtilization = await this.getDepartmentUtilization();

    return {
      hourly_volume: hourlyVolume,
      department_utilization: departmentUtilization,
    };
  }

  /**
   * Get hourly patient volume for last N hours
   */
  static async getHourlyPatientVolume(hours = 24) {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Get hourly admissions
    const hourlyAdmissions = await Admission.findAll({
      where: {
        admission_date: { [Op.gte]: startTime },
      },
      attributes: [
        [Sequelize.fn('HOUR', Sequelize.col('admission_date')), 'hour'],
        [Sequelize.fn('COUNT', Sequelize.col('admission_id')), 'count'],
      ],
      group: ['hour'],
      raw: true,
    });

    // Get hourly ER visits
    const hourlyERVisits = await ERVisit.findAll({
      where: {
        arrival_time: { [Op.gte]: startTime },
      },
      attributes: [
        [Sequelize.fn('HOUR', Sequelize.col('arrival_time')), 'hour'],
        [Sequelize.fn('COUNT', Sequelize.col('er_visit_id')), 'count'],
      ],
      group: ['hour'],
      raw: true,
    });

    // Initialize array for 24 hours
    const hoursArray = Array.from({ length: 24 }, (_, i) => i);
    const result = hoursArray.map(hour => {
      const admissions = hourlyAdmissions.find(h => parseInt(h.hour) === hour);
      const erVisits = hourlyERVisits.find(h => parseInt(h.hour) === hour);

      return {
        hour: hour,
        time_label: `${hour}:00`,
        admissions: parseInt(admissions?.count || 0),
        er_visits: parseInt(erVisits?.count || 0),
        total:
          parseInt(admissions?.count || 0) + parseInt(erVisits?.count || 0),
      };
    });

    // Sort by hour (oldest to newest)
    return result.sort((a, b) => a.hour - b.hour);
  }

  /**
   * Get department utilization statistics
   */
  static async getDepartmentUtilization() {
    const departments = await Department.findAll({
      include: [
        {
          association: 'rooms',
          include: [
            {
              association: 'beds',
              attributes: ['bed_status'],
            },
          ],
        },
      ],
    });

    return departments.map(dept => {
      const beds = dept.rooms?.flatMap(room => room.beds || []) || [];
      const totalBeds = beds.length;
      const occupiedBeds = beds.filter(
        bed => bed.bed_status === 'occupied',
      ).length;
      const availableBeds = totalBeds - occupiedBeds;

      return {
        department_id: dept.department_id,
        department_name: dept.department_name,
        department_code: dept.department_code,
        total_beds: totalBeds,
        occupied_beds: occupiedBeds,
        available_beds: availableBeds,
        utilization_rate:
          totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      };
    });
  }

  /**
   * Get complete overview data for dashboard
   */
  static async getDashboardOverview() {
    try {
      const [liveStats, criticalAlerts, activityTimeline, performanceCharts] =
        await Promise.all([
          this.getLiveStats(),
          this.getCriticalAlerts(),
          this.getActivityTimeline(),
          this.getPerformanceCharts(),
        ]);

      return {
        live_stats: liveStats,
        critical_alerts: criticalAlerts,
        activity_timeline: activityTimeline,
        performance_charts: performanceCharts,
        last_updated: new Date(),
      };
    } catch (error) {
      console.error('Error in getDashboardOverview:', error);
      throw error;
    }
  }
}

export default OverviewService;
