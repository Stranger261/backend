import AppError from '../../../shared/utils/AppError.util.js';
import sequelize from '../../../shared/config/db.config.js';

export default class appointmentQueryService {
  async getAllAppointments(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        searchTerm = '',
        status,
        priority,
        isFollowUp,
        doctorId,
        departmentId,
        startDate,
        endDate,
        today,
        upcoming,
        dateRange,
      } = filters;

      const offset = (page - 1) * limit;

      const whereClause = {};
      const Op = sequelize.op;

      if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (priority && priority !== 'all') {
        whereClause.priority = priority;
      }

      if (isFollowUp && isFollowUp !== ' all') {
        whereClause.isFollowUp = isFollowUp === 'true';
      }

      if (doctorId) {
        whereClause.doctor_id = doctorId;
      }

      if (departmentId) {
        whereClause.department_id = departmentId;
      }

      if (startDate && endDate) {
        whereClause.appointment_date = { [Op.between]: [startDate, endDate] };
      }

      if (dateRange && dateRange !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (dateRange) {
          case 'today':
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            whereClause.appointment_date = { [Op.between]: [today, endOfDay] };
            break;

          case 'tomorrow':
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const endOfTomorrow = new Date(tomorrow);
            endOfTomorrow.setHours(23, 59, 59, 999);
            whereClause.appointment_date = {
              [Op.between]: [today, endOfTomorrow],
            };
            break;

          case 'week':
            const weekEnd = new Date(today);
            weekEnd.setDate(today.getDate() + 7);
            whereClause.appointment_date = { [Op.between]: [today, weekEnd] };
            break;

          case 'month':
            const monthStart = new Date(
              today.getFullYear(),
              today.getMonth(),
              1
            );
            const monthEnd = new Date(
              today.getFullYear(),
              today.getMonth() + 1,
              0
            );
            whereClause.appointment_date = {
              [Op.between]: [monthStart, monthEnd],
            };
            break;
        }
      }

      if (today === 'true') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        whereClause.appointment_date = {
          [Op.between]: [today, endOfDay],
        };
      }

      // Upcoming filter
      if (upcoming === 'true') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        whereClause.appointment_date = {
          [Op.gte]: today,
        };
        whereClause.status = 'scheduled';
      }

      const { count, rows: appointments } =
        await models.Appointment.findAndCountAll([]);

      // ==================== FINISH THIS
    } catch (error) {
      console.log('Get all appointment failed: ', error);
      throw (
        (error instanceof AppError ? AppError : 'Internal server error.', 500)
      );
    }
  }
}
