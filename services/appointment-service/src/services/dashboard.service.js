import {
  Patient,
  Appointment,
  Staff,
  Person,
  LabOrder,
  Prescription,
  BillingTransaction,
  sequelize,
  AppointmentCheckIn,
  AppointmentVitals,
} from '../../../shared/models/index.js';

import { Op } from 'sequelize';
import AppError from '../../../shared/utils/AppError.util.js';

class DashboardService {
  // Common date calculations
  static getDateRanges() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    return { today, yesterday, startOfWeek, startOfMonth };
  }

  // ==================== SHARED STATS ====================
  static async getCommonPatientStats() {
    const { today } = this.getDateRanges();

    const [totalPatients, activePatients, newPatientsToday] = await Promise.all(
      [
        Patient.count(),
        Patient.count({ where: { patient_status: 'active' } }),
        Patient.count({ where: { created_at: { [Op.gte]: today } } }),
      ],
    );

    return { totalPatients, activePatients, newPatientsToday };
  }

  // ==================== DOCTOR STATS ====================
  static async getDoctorStats(doctorId) {
    const { today, yesterday, startOfWeek, startOfMonth } =
      this.getDateRanges();

    // Calculate comparison dates
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastMonthStart = new Date(startOfMonth);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    // Helper function to get appointment counts
    const getAppointmentCount = async (doctorId, date, statusFilter) => {
      const whereClause = {
        doctor_id: doctorId,
        appointment_date: date,
      };

      if (statusFilter === 'completed') {
        whereClause.status = 'completed';
      } else if (statusFilter === 'active') {
        whereClause.status = {
          [Op.in]: ['scheduled', 'in_progress', 'completed'],
        };
      } else if (Array.isArray(statusFilter)) {
        whereClause.status = { [Op.in]: statusFilter };
      } else if (statusFilter) {
        whereClause.status = statusFilter;
      }

      return Appointment.count({ where: whereClause });
    };

    // Get all basic appointment data first
    const [
      todaysAppointments,
      yesterdaysAppointments,
      todaysCompleted,
      yesterdaysCompleted,
      todaysInProgress,
      todaysScheduled,
      totalPatientsUnderCare,
      patientsSeenThisWeek,
      patientsSeenLastWeek,
      pendingLabResults,
      pendingPrescriptions,
    ] = await Promise.all([
      // Today's total appointments (excluding cancelled/no_show)
      Appointment.count({
        where: {
          doctor_id: doctorId,
          appointment_date: today,
          status: { [Op.notIn]: ['cancelled', 'no_show'] },
        },
      }),

      // Yesterday's total appointments
      Appointment.count({
        where: {
          doctor_id: doctorId,
          appointment_date: yesterday,
          status: { [Op.notIn]: ['cancelled', 'no_show'] },
        },
      }),

      // Today's completed appointments
      getAppointmentCount(doctorId, today, 'completed'),

      // Yesterday's completed appointments
      getAppointmentCount(doctorId, yesterday, 'completed'),

      // Today's in progress appointments
      getAppointmentCount(doctorId, today, 'in_progress'),

      // Today's scheduled appointments
      getAppointmentCount(doctorId, today, 'scheduled'),

      // Total patients under care (distinct)
      Appointment.count({
        where: { doctor_id: doctorId },
        distinct: true,
        col: 'patient_id',
      }),

      // Patients seen this week
      Appointment.count({
        where: {
          doctor_id: doctorId,
          appointment_date: { [Op.between]: [startOfWeek, today] },
          status: 'completed',
        },
        distinct: true,
        col: 'patient_id',
      }),

      // Patients seen last week
      Appointment.count({
        where: {
          doctor_id: doctorId,
          appointment_date: { [Op.between]: [lastWeekStart, startOfWeek] },
          status: 'completed',
        },
        distinct: true,
        col: 'patient_id',
      }),

      // Pending lab results
      LabOrder.count({
        where: {
          ordered_by: doctorId,
          order_status: 'pending',
        },
      }),

      // Pending prescriptions
      Prescription.count({
        where: {
          prescribed_by: doctorId,
          prescription_status: 'pending_review',
        },
      }),
    ]);

    // Get average durations using Sequelize instead of raw SQL
    const [avgDurationResult, lastMonthAvgDuration] = await Promise.all([
      // Average duration this month
      Appointment.findOne({
        where: {
          doctor_id: doctorId,
          appointment_date: { [Op.between]: [startOfMonth, today] },
          status: 'completed',
          duration_minutes: { [Op.not]: null },
        },
        attributes: [
          [
            sequelize.fn(
              'ROUND',
              sequelize.fn('AVG', sequelize.col('duration_minutes')),
              0,
            ),
            'avgDuration',
          ],
        ],
        raw: true,
      }),

      // Average duration last month
      Appointment.findOne({
        where: {
          doctor_id: doctorId,
          appointment_date: { [Op.between]: [lastMonthStart, startOfMonth] },
          status: 'completed',
          duration_minutes: { [Op.not]: null },
        },
        attributes: [
          [
            sequelize.fn(
              'ROUND',
              sequelize.fn('AVG', sequelize.col('duration_minutes')),
              0,
            ),
            'avgDuration',
          ],
        ],
        raw: true,
      }),
    ]);

    // Get completion rates using Sequelize
    const getCompletionRate = async (startDate, endDate) => {
      try {
        const result = await Appointment.findOne({
          where: {
            doctor_id: doctorId,
            appointment_date: { [Op.between]: [startDate, endDate] },
          },
          attributes: [
            [
              sequelize.literal(`
                ROUND(
                  (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0) /
                  NULLIF(SUM(CASE WHEN status IN ('scheduled', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0)
                , 0)
              `),
              'completionRate',
            ],
          ],
          raw: true,
        });
        return result?.completionRate || 0;
      } catch (error) {
        console.error('Error calculating completion rate:', error);
        return 0;
      }
    };

    const [completionRateThisMonth, completionRateLastMonth] =
      await Promise.all([
        getCompletionRate(startOfMonth, today),
        getCompletionRate(lastMonthStart, startOfMonth),
      ]);

    // Helper function to get revenue for a specific date
    const getRevenueForDate = async date => {
      try {
        const appointments = await Appointment.findAll({
          where: {
            doctor_id: doctorId,
            appointment_date: date,
          },
          attributes: ['appointment_id'],
          raw: true,
        });

        const appointmentIds = appointments.map(a => a.appointment_id);
        if (appointmentIds.length === 0) return 0;

        const revenue = await BillingTransaction.sum('amount', {
          where: {
            appointment_id: { [Op.in]: appointmentIds },
            payment_status: 'paid',
          },
        });

        return revenue || 0;
      } catch (error) {
        console.error('Error calculating revenue:', error);
        return 0;
      }
    };

    // Get revenue data
    const [todaysRevenue, yesterdaysRevenue] = await Promise.all([
      getRevenueForDate(today),
      getRevenueForDate(yesterday),
    ]);

    // ============= CALCULATE TRENDS =============

    // 1. Today vs Yesterday Appointments Trend
    const appointmentTrend =
      yesterdaysAppointments > 0
        ? Math.round(
            ((todaysAppointments - yesterdaysAppointments) /
              yesterdaysAppointments) *
              100,
          )
        : todaysAppointments > 0
          ? 100
          : 0;

    // 2. Completion Rate Trend (Today)
    const todaysCompletionRate =
      todaysAppointments > 0
        ? Math.round((todaysCompleted / todaysAppointments) * 100)
        : 0;

    const yesterdaysCompletionRate =
      yesterdaysAppointments > 0
        ? Math.round((yesterdaysCompleted / yesterdaysAppointments) * 100)
        : 0;

    const completionTrend =
      yesterdaysCompletionRate > 0
        ? todaysCompletionRate - yesterdaysCompletionRate
        : todaysCompletionRate > 0
          ? 100
          : 0;

    // 3. Patient Trend (This week vs Last week)
    const patientTrend =
      patientsSeenLastWeek > 0
        ? Math.round(
            ((patientsSeenThisWeek - patientsSeenLastWeek) /
              patientsSeenLastWeek) *
              100,
          )
        : patientsSeenThisWeek > 0
          ? 100
          : 0;

    // 4. Average Duration Trend (lower is better)
    const currentAvgDuration = parseInt(avgDurationResult?.avgDuration) || 0;
    const lastAvgDuration = parseInt(lastMonthAvgDuration?.avgDuration) || 0;
    const durationTrend =
      lastAvgDuration > 0
        ? Math.round(
            ((currentAvgDuration - lastAvgDuration) / lastAvgDuration) *
              100 *
              -1,
          )
        : currentAvgDuration > 0
          ? -100
          : 0;

    // 5. Monthly Completion Trend
    const currentMonthRate = parseInt(completionRateThisMonth) || 0;
    const lastMonthRate = parseInt(completionRateLastMonth) || 0;
    const monthlyCompletionTrend =
      lastMonthRate > 0
        ? Math.round(((currentMonthRate - lastMonthRate) / lastMonthRate) * 100)
        : currentMonthRate > 0
          ? 100
          : 0;

    // 6. Revenue Trend
    const revenueTrend =
      yesterdaysRevenue > 0
        ? Math.round(
            ((todaysRevenue - yesterdaysRevenue) / yesterdaysRevenue) * 100,
          )
        : todaysRevenue > 0
          ? 100
          : 0;

    return {
      todaysOverview: {
        total: todaysAppointments,
        completed: todaysCompleted,
        inProgress: todaysInProgress,
        scheduled: todaysScheduled,
        completionRate: todaysCompletionRate,
        appointmentTrend,
        completionTrend,
        revenue: todaysRevenue,
        revenueTrend,
      },

      patientPanel: {
        totalUnderCare: totalPatientsUnderCare,
        seenThisWeek: patientsSeenThisWeek,
        patientTrend,
      },

      performance: {
        avgConsultationDuration: currentAvgDuration,
        durationTrend,
        monthlyCompletionRate: currentMonthRate,
        monthlyCompletionTrend,
      },

      pendingTasks: {
        labResults: pendingLabResults,
        prescriptions: pendingPrescriptions,
      },
    };
  }

  // ==================== RECEPTIONIST STATS ====================
  static async getReceptionistStats() {
    const { today, startOfWeek } = this.getDateRanges();

    const [
      todaysAppointments,
      todaysRevenue,
      weeklyRevenue,
      appointmentTypesToday,
      waitingPatients,
    ] = await Promise.all([
      // Today's appointments
      Appointment.count({ where: { appointment_date: today } }),

      // Today's revenue
      BillingTransaction.sum('amount', {
        where: {
          created_at: { [Op.gte]: today },
          payment_status: 'paid',
        },
      }),

      // Weekly revenue
      BillingTransaction.sum('amount', {
        where: {
          created_at: { [Op.between]: [startOfWeek, today] },
          payment_status: 'paid',
        },
      }),

      // Appointment types
      Appointment.findAll({
        where: { appointment_date: today },
        attributes: [
          'appointment_type',
          [sequelize.fn('COUNT', sequelize.col('*')), 'count'],
        ],
        group: ['appointment_type'],
        raw: true,
      }),

      // Waiting patients (not checked in yet)
      Appointment.count({
        where: {
          appointment_date: today,
          status: 'scheduled',
          '$checkIn.check_in_id$': null,
        },
        include: [
          {
            model: AppointmentCheckIn,
            as: 'checkIn',
            required: false,
            attributes: [],
          },
        ],
      }),
    ]);

    // Format appointment types
    const appointmentTypes = {};
    appointmentTypesToday.forEach(type => {
      appointmentTypes[type.appointment_type] = type.count;
    });

    return {
      todaysOverview: {
        appointments: todaysAppointments,
        revenue: todaysRevenue || 0,
        waitingPatients,
      },

      financial: {
        weeklyRevenue: weeklyRevenue || 0,
      },

      breakdown: {
        appointmentTypes,
      },
    };
  }

  // ==================== NURSE STATS ====================
  static async getNurseStats(nurseId) {
    const { today } = this.getDateRanges();

    const [vitalSignsToRecord, medicationRounds] = await Promise.all([
      // Pending vital signs
      Appointment.count({
        where: {
          appointment_date: today,
          '$vitals.vital_id$': null,
        },
        include: [
          {
            model: AppointmentVitals,
            as: 'vitals',
            required: false,
            attributes: [],
          },
        ],
      }),

      // Medication rounds due
      Prescription.count({
        where: {
          prescription_status: 'active',
          // next_admin_time: { [Op.lte]: new Date() }, // Uncomment if you have this field
        },
      }),
    ]);

    return {
      pendingTasks: {
        vitalSigns: vitalSignsToRecord,
        medicationRounds,
      },
    };
  }

  // ==================== PATIENT STATS ====================
  static async getPatientStats(patientId) {
    const { today } = this.getDateRanges();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      upcomingAppointments,
      pendingPrescriptions,
      recentLabResults,
      outstandingBills,
    ] = await Promise.all([
      // Upcoming appointments
      Appointment.count({
        where: {
          patient_id: patientId,
          appointment_date: { [Op.gte]: today },
          status: 'scheduled',
        },
      }),

      // Active prescriptions
      Prescription.count({
        where: {
          patient_id: patientId,
          prescription_status: 'active',
        },
      }),

      // Recent lab results
      LabOrder.count({
        where: {
          patient_id: patientId,
          order_status: 'completed',
          order_date: { [Op.gte]: thirtyDaysAgo },
        },
      }),

      // Outstanding bills
      BillingTransaction.sum('amount', {
        where: {
          patient_id: patientId,
          payment_status: 'unpaid',
        },
      }),
    ]);

    return {
      upcomingAppointments,
      pendingPrescriptions,
      recentLabResults,
      outstandingBills: outstandingBills || 0,
    };
  }

  // ==================== PATIENT APPOINTMENTS ====================
  static async getPatientUpcomingAppointments(patientUuid) {
    const { today } = this.getDateRanges();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      const patient = await Patient.findOne({
        where: {
          patient_uuid: patientUuid,
        },
      });

      if (!patient) {
        throw new AppError('Patient not found.', 404);
      }

      const patientId = patient.patient_id;

      const [todaysAppointments, upcomingAppointments] = await Promise.all([
        // Today's appointments with full details
        Appointment.findAll({
          where: {
            patient_id: patientId,
            appointment_date: today,
            status: {
              [Op.in]: ['scheduled', 'confirmed', 'arrived', 'in_progress'],
            },
          },
          include: [
            {
              model: Patient,
              as: 'patient',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'last_name',
                    'date_of_birth',
                    'gender',
                  ],
                },
              ],
              attributes: ['patient_id', 'mrn'],
            },
            {
              model: Staff,
              as: 'doctor',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: ['first_name', 'last_name'],
                },
              ],
            },
          ],
          order: [['appointment_time', 'ASC']],
        }),

        // Upcoming appointments (tomorrow to 7 days from now)
        Appointment.findAll({
          where: {
            patient_id: patientId,
            appointment_date: {
              [Op.gt]: today,
              [Op.lte]: sevenDaysFromNow,
            },
            status: { [Op.in]: ['scheduled', 'confirmed'] },
          },
          include: [
            {
              model: Patient,
              as: 'patient',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: [
                    'first_name',
                    'last_name',
                    'date_of_birth',
                    'gender',
                  ],
                },
              ],
              attributes: ['patient_id', 'mrn'],
            },
            {
              model: Staff,
              as: 'doctor',
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: ['first_name', 'last_name'],
                },
              ],
            },
          ],
          order: [
            ['appointment_date', 'ASC'],
            ['appointment_time', 'ASC'],
          ],
        }),
      ]);

      return {
        todaysAppointments,
        upcomingAppointments,
      };
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get upcoming appointments.', 500);
    }
  }

  // ==================== MAIN ENTRY POINT ====================
  static async getDashboardStats(userRole, userId = null) {
    const commonStats = await this.getCommonPatientStats();
    let roleSpecificStats = {};

    try {
      switch (userRole) {
        case 'doctor':
          const doctor = await Staff.findOne({
            where: { staff_uuid: userId },
            attributes: ['staff_id'],
          });
          if (doctor) {
            roleSpecificStats = await this.getDoctorStats(doctor.staff_id);
          }
          break;

        case 'receptionist':
          roleSpecificStats = await this.getReceptionistStats();
          break;

        case 'nurse':
          roleSpecificStats = await this.getNurseStats(userId);
          break;

        case 'patient':
          const patient = await Patient.findOne({
            where: { patient_uuid: userId },
            attributes: ['patient_id'],
          });
          if (patient) {
            roleSpecificStats = await this.getPatientStats(patient.patient_id);
          }
          break;

        case 'admin':
          roleSpecificStats = await this.getAdminStats();
          break;
      }
    } catch (error) {
      console.error(`Error getting ${userRole} dashboard stats:`, error);
      roleSpecificStats = {};
    }

    return {
      ...commonStats,
      ...roleSpecificStats,
      timestamp: new Date().toISOString(),
      role: userRole,
    };
  }

  // ==================== HELPER METHODS ====================
  static formatAppointment(appointment) {
    if (!appointment || !appointment.patient || !appointment.patient.person)
      return null;

    return {
      patientName: `${appointment.patient.person.first_name} ${appointment.patient.person.last_name}`,
      patientId: appointment.patient.patient_uuid,
      appointmentId: appointment.appointment_id,
      type: appointment.appointment_type,
      time: appointment.appointment_time,
      status: appointment.status,
    };
  }

  static async getAdminStats() {
    try {
      // Note: You need to import User model if it exists
      // If not, you can remove or adjust this part
      const totalStaff = await Staff.count();

      return {
        systemHealth: {
          totalUsers: 0, // Placeholder - update with actual User model
          totalStaff,
        },
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      return {
        systemHealth: {
          totalUsers: 0,
          totalStaff: 0,
        },
      };
    }
  }
}

export default DashboardService;
