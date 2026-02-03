// services/dashboard/AnalyticsService.js
import { Op, Sequelize } from 'sequelize';
import {
  Admission,
  ERVisit,
  Appointment,
  sequelize,
} from '../../../shared/models/index.js';

class AnalyticsService {
  /**
   * Pre-built reports
   */
  static async getPrebuiltReports() {
    return {
      revenue: await this.generateRevenueReport(),
      patient_volume: await this.generatePatientVolumeReport(),
      er_metrics: await this.generateERMetricsReport(),
      prescription_analytics: await this.generatePrescriptionReport(),
      bed_utilization: await this.generateBedUtilizationReport(),
    };
  }

  /**
   * Revenue report
   */
  static async generateRevenueReport(period = 'month') {
    const dateRange = this.getDateRange(period);

    const revenue = await RevenueTransaction.findAll({
      where: {
        transaction_date: { [Op.between]: [dateRange.start, dateRange.end] },
        payment_status: 'paid',
      },
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total_revenue'],
        [
          Sequelize.fn('COUNT', Sequelize.col('transaction_id')),
          'total_transactions',
        ],
        [Sequelize.fn('AVG', Sequelize.col('amount')), 'average_transaction'],
      ],
      raw: true,
    });

    // Revenue by service type
    const revenueByService = await RevenueTransaction.findAll({
      where: {
        transaction_date: { [Op.between]: [dateRange.start, dateRange.end] },
        payment_status: 'paid',
      },
      attributes: [
        'service_type',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'revenue'],
        [
          Sequelize.fn('COUNT', Sequelize.col('transaction_id')),
          'transactions',
        ],
      ],
      group: ['service_type'],
      order: [[Sequelize.literal('revenue'), 'DESC']],
      raw: true,
    });

    // Daily revenue trend
    const dailyRevenue = await RevenueTransaction.findAll({
      where: {
        transaction_date: { [Op.between]: [dateRange.start, dateRange.end] },
        payment_status: 'paid',
      },
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('transaction_date')), 'date'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'daily_revenue'],
        [
          Sequelize.fn('COUNT', Sequelize.col('transaction_id')),
          'daily_transactions',
        ],
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('transaction_date'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('transaction_date')), 'ASC']],
      raw: true,
    });

    return {
      period: period,
      date_range: dateRange,
      summary: revenue[0],
      by_service_type: revenueByService,
      daily_trend: dailyRevenue,
    };
  }

  /**
   * Patient volume report
   */
  static async generatePatientVolumeReport(period = 'month') {
    const dateRange = this.getDateRange(period);

    // Admission volume
    const admissions = await Admission.findAll({
      where: {
        admission_date: { [Op.between]: [dateRange.start, dateRange.end] },
      },
      attributes: [
        'admission_type',
        [Sequelize.fn('COUNT', Sequelize.col('admission_id')), 'count'],
      ],
      group: ['admission_type'],
      raw: true,
    });

    // ER visit volume
    const erVisits = await ERVisit.findAll({
      where: {
        arrival_time: { [Op.between]: [dateRange.start, dateRange.end] },
      },
      attributes: [
        'triage_level',
        'disposition_type',
        [Sequelize.fn('COUNT', Sequelize.col('er_visit_id')), 'count'],
      ],
      group: ['triage_level', 'disposition_type'],
      raw: true,
    });

    // Appointment volume
    const appointments = await Appointment.findAll({
      where: {
        appointment_date: { [Op.between]: [dateRange.start, dateRange.end] },
        status: { [Op.ne]: 'cancelled' },
      },
      attributes: [
        'appointment_type',
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('appointment_id')), 'count'],
      ],
      group: ['appointment_type', 'status'],
      raw: true,
    });

    // Patient demographics
    const demographics = await sequelize.query(
      `
      SELECT 
        p.gender,
        FLOOR(DATEDIFF(CURDATE(), p.date_of_birth) / 365) as age_group,
        COUNT(DISTINCT a.patient_id) as patient_count
      FROM admissions a
      JOIN patient pt ON a.patient_id = pt.patient_id
      JOIN person p ON pt.person_id = p.person_id
      WHERE a.admission_date BETWEEN ? AND ?
      GROUP BY p.gender, age_group
      ORDER BY p.gender, age_group
    `,
      {
        replacements: [dateRange.start, dateRange.end],
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    return {
      period: period,
      date_range: dateRange,
      admissions_by_type: admissions,
      er_visits: erVisits,
      appointments: appointments,
      patient_demographics: demographics,
    };
  }

  /**
   * ER metrics report
   */
  static async generateERMetricsReport(period = 'month') {
    const dateRange = this.getDateRange(period);

    const erData = await ERVisit.findAll({
      where: {
        arrival_time: { [Op.between]: [dateRange.start, dateRange.end] },
      },
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('er_visit_id')), 'total_visits'],
        [
          Sequelize.fn('AVG', Sequelize.col('total_er_time_minutes')),
          'avg_wait_time',
        ],
        [
          Sequelize.fn('MAX', Sequelize.col('total_er_time_minutes')),
          'max_wait_time',
        ],
        [
          Sequelize.fn('MIN', Sequelize.col('total_er_time_minutes')),
          'min_wait_time',
        ],
      ],
      raw: true,
    });

    // Triage distribution
    const triageDistribution = await ERVisit.findAll({
      where: {
        arrival_time: { [Op.between]: [dateRange.start, dateRange.end] },
      },
      attributes: [
        'triage_level',
        [Sequelize.fn('COUNT', Sequelize.col('er_visit_id')), 'count'],
      ],
      group: ['triage_level'],
      order: [['triage_level', 'ASC']],
      raw: true,
    });

    // Disposition breakdown
    const dispositionBreakdown = await ERVisit.findAll({
      where: {
        arrival_time: { [Op.between]: [dateRange.start, dateRange.end] },
      },
      attributes: [
        'disposition_type',
        [Sequelize.fn('COUNT', Sequelize.col('er_visit_id')), 'count'],
      ],
      group: ['disposition_type'],
      raw: true,
    });

    // Hourly arrival pattern
    const hourlyPattern = await ERVisit.findAll({
      where: {
        arrival_time: { [Op.between]: [dateRange.start, dateRange.end] },
      },
      attributes: [
        [Sequelize.fn('HOUR', Sequelize.col('arrival_time')), 'hour'],
        [Sequelize.fn('COUNT', Sequelize.col('er_visit_id')), 'arrivals'],
      ],
      group: [Sequelize.fn('HOUR', Sequelize.col('arrival_time'))],
      order: [[Sequelize.fn('HOUR', Sequelize.col('arrival_time')), 'ASC']],
      raw: true,
    });

    // Door-to-doctor time analysis
    const doorToDoctor = await sequelize.query(
      `
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, arrival_time, disposition_time)) as avg_door_to_doctor,
        MAX(TIMESTAMPDIFF(MINUTE, arrival_time, disposition_time)) as max_door_to_doctor,
        MIN(TIMESTAMPDIFF(MINUTE, arrival_time, disposition_time)) as min_door_to_doctor
      FROM er_visits
      WHERE arrival_time BETWEEN ? AND ?
      AND disposition_time IS NOT NULL
      AND triage_level IN (1, 2)
    `,
      {
        replacements: [dateRange.start, dateRange.end],
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    return {
      period: period,
      date_range: dateRange,
      summary: erData[0],
      triage_distribution: triageDistribution,
      disposition_breakdown: dispositionBreakdown,
      hourly_arrival_pattern: hourlyPattern,
      door_to_doctor_time: doorToDoctor[0],
    };
  }

  /**
   * Custom report builder
   */
  static async buildCustomReport(parameters) {
    const {
      report_type,
      date_range,
      filters = {},
      group_by = [],
      metrics = [],
      sort_by = [],
      limit = 1000,
    } = parameters;

    let query;

    switch (report_type) {
      case 'admissions':
        query = this.buildAdmissionQuery(
          date_range,
          filters,
          group_by,
          metrics,
        );
        break;
      case 'er_visits':
        query = this.buildERQuery(date_range, filters, group_by, metrics);
        break;
      case 'appointments':
        query = this.buildAppointmentQuery(
          date_range,
          filters,
          group_by,
          metrics,
        );
        break;
      case 'revenue':
        query = this.buildRevenueQuery(date_range, filters, group_by, metrics);
        break;
      case 'prescriptions':
        query = this.buildPrescriptionQuery(
          date_range,
          filters,
          group_by,
          metrics,
        );
        break;
      default:
        throw new Error(`Unsupported report type: ${report_type}`);
    }

    // Add sorting
    if (sort_by.length > 0) {
      query.order = sort_by.map(sort => {
        const [field, direction] = sort.split(':');
        return [field, direction || 'ASC'];
      });
    }

    // Add limit
    query.limit = limit;

    // Execute query
    const results = await Admission.sequelize.query(
      this.sequelizeQueryToString(query),
      {
        type: Sequelize.QueryTypes.SELECT,
        replacements: query.replacements,
      },
    );

    return {
      report_type,
      parameters,
      total_records: results.length,
      data: results,
      generated_at: new Date(),
    };
  }

  static buildAdmissionQuery(dateRange, filters, groupBy, metrics) {
    const baseQuery = `
      SELECT 
        ${metrics.length > 0 ? metrics.join(', ') : '*'}
      FROM admissions a
      JOIN patient p ON a.patient_id = p.patient_id
      JOIN person ps ON p.person_id = ps.person_id
      WHERE a.admission_date BETWEEN ? AND ?
    `;

    const replacements = [dateRange.start, dateRange.end];

    // Add filters
    const whereClauses = [];
    if (filters.admission_type) {
      whereClauses.push('a.admission_type = ?');
      replacements.push(filters.admission_type);
    }
    if (filters.admission_status) {
      whereClauses.push('a.admission_status = ?');
      replacements.push(filters.admission_status);
    }

    // Build complete query
    let query = baseQuery;
    if (whereClauses.length > 0) {
      query += ' AND ' + whereClauses.join(' AND ');
    }

    // Add grouping
    if (groupBy.length > 0) {
      query += ` GROUP BY ${groupBy.join(', ')}`;
    }

    return { query, replacements };
  }

  static sequelizeQueryToString(queryObj) {
    return queryObj.query;
  }

  /**
   * Save custom report
   */
  static async saveCustomReport(userId, reportName, parameters) {
    return await SavedReport.create({
      user_id: userId,
      report_name: reportName,
      parameters: JSON.stringify(parameters),
      last_generated: new Date(),
    });
  }

  /**
   * Export report to various formats
   */
  static async exportReport(reportData, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(reportData, null, 2);
      case 'csv':
        return this.convertToCSV(reportData);
      case 'excel':
        return this.convertToExcel(reportData);
      case 'pdf':
        return this.convertToPDF(reportData);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static convertToCSV(data) {
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return '';
    }

    const headers = Object.keys(data.data[0]).join(',');
    const rows = data.data.map(row =>
      Object.values(row)
        .map(value =>
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value,
        )
        .join(','),
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Schedule report generation
   */
  static async scheduleReport(userId, reportConfig) {
    // This would integrate with a job scheduler like Bull or Agenda
    const scheduledReport = await SavedReport.create({
      user_id: userId,
      report_name: reportConfig.name,
      parameters: JSON.stringify(reportConfig.parameters),
      schedule_cron: reportConfig.schedule,
      schedule_active: true,
      last_generated: null,
    });

    // Queue the scheduled job
    await this.queueReportJob(scheduledReport.report_id, reportConfig);

    return scheduledReport;
  }

  static async queueReportJob(reportId, config) {
    // Implementation would depend on your job queue system
    // Example with Bull:
    // reportQueue.add('generate-scheduled-report', {
    //   reportId,
    //   config
    // }, {
    //   repeat: { cron: config.schedule }
    // });
  }

  /**
   * Helper function to get date range
   */
  static getDateRange(period) {
    const end = new Date();
    let start = new Date();

    switch (period) {
      case 'day':
        start.setDate(end.getDate() - 1);
        break;
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setMonth(end.getMonth() - 1);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }
}

export default AnalyticsService;
