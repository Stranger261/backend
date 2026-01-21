import { Op } from 'sequelize';
import {
  format,
  startOfDay,
  addMonths,
  eachDayOfInterval,
  parseISO,
} from 'date-fns';

import {
  Staff,
  Person,
  Patient,
  Department,
  DoctorSchedule,
  DoctorLeave,
  Appointment,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class DoctorService {
  async getAllDepartments() {
    try {
      const departments = await Department.findAll({
        attributes: [
          'department_id',
          'department_name',
          'department_code',
          'location',
        ],
        order: [['department_name', 'ASC']],
      });

      return departments.map(dept => ({
        department_id: dept.department_id,
        _id: dept.department_id,
        department_name: dept.department_name,
        department_code: dept.department_code,
        department_location: dept.location,
      }));
    } catch (error) {
      console.error('Get departments error:', error);
      throw new AppError('Failed to get departments', 500);
    }
  }

  async getAllDoctors() {
    try {
      const doctors = await Staff.findAll({
        where: {
          role: 'doctor',
          employment_status: 'active',
        },
        include: [
          {
            model: Person,
            as: 'person',
            attributes: ['first_name', 'last_name', 'gender'],
          },
          {
            model: Department,
            as: 'department',
            attributes: ['department_id', 'department_name', 'location'],
          },
        ],
        attributes: [
          'staff_id',
          'staff_uuid',
          'specialization',
          'license_number',
        ],
        order: [['department_id', 'ASC']],
      });

      return doctors.map(doctor => ({
        staff_id: doctor.staff_id,
        staff_uuid: doctor.staff_uuid,
        _id: doctor.staff_id, // For frontend compatibility
        name: `Dr. ${doctor.person.first_name} ${doctor.person.last_name}`,
        firstname: doctor.person.first_name,
        lastname: doctor.person.last_name,
        specialization: doctor.specialization,
        license_number: doctor.license_number,
        department: doctor.department
          ? {
              _id: doctor.department.department_id,
              name: doctor.department.department_name,
              location: doctor.department.location,
            }
          : null,
      }));
    } catch (error) {
      console.error('Get all doctors error:', error);
      throw new AppError('Failed to get doctors', 500);
    }
  }

  async getDoctorsByDepartment(departmentId, patientId = null) {
    try {
      let patient;
      if (patientId) {
        patient = await Patient.findOne({
          where: { patient_id: patientId },
        });
      }

      const doctors = await Staff.findAll({
        where: {
          department_id: departmentId,
          role: 'doctor',
          employment_status: 'active',
        },
        include: [
          {
            model: Person,
            as: 'person',
            attributes: [
              'first_name',
              'middle_name',
              'last_name',
              'gender',
              'gender_specification',
            ],
          },
          {
            model: Department,
            as: 'department',
            attributes: ['department_name', 'location', 'department_code'],
          },
        ],
        attributes: [
          'staff_id',
          'staff_uuid',
          'specialization',
          'license_number',
        ],
      });

      let recommended = [];
      if (patient) {
        const pastAppointments = await Appointment.findAll({
          where: {
            patient_id: patient.patient_id,
            department_id: departmentId,
            status: { [Op.in]: ['completed', 'in_progress'] },
          },
          attributes: ['doctor_id'],
          group: ['doctor_id'],
        });

        recommended = pastAppointments.map(apt => apt.doctor_id);
      }

      const formattedDoctors = doctors.map(doctor => ({
        staff_id: doctor.staff_id,
        _id: doctor.staff_id,
        staff_uuid: doctor.staff_uuid,
        name: `Dr. ${doctor.person.first_name}${
          doctor.person.middle_name ? doctor.person.middle_name : ' '
        }${doctor.person.last_name}`,
        firstname: doctor.person.first_name,
        lastname: doctor.person.last_name,
        specialization: doctor.specialization,
        license_number: doctor.license_number,
        department: {
          _id: doctor.department.department_id,
          name: doctor.department.department_name,
        },
        is_recommended: recommended.includes(doctor.staff_id),
      }));

      return formattedDoctors;
    } catch (error) {
      console.error('Get doctors by department error:', error);
      throw new AppError('Failed to get doctors', 500);
    }
  }

  async getDoctorAvailability(doctorUuid, startDate = null, endDate = null) {
    try {
      const today = startOfDay(new Date());
      const start = startDate ? parseISO(startDate) : today;
      const end = endDate ? parseISO(endDate) : addMonths(today, 3);

      const doctor = await Staff.findOne({ where: { staff_uuid: doctorUuid } });

      const doctorId = doctor.staff_id;

      const schedules = await DoctorSchedule.findAll({
        where: { staff_id: doctorId, is_active: true },
      });

      if (schedules.length === 0) {
        return { availableSlots: [] };
      }

      // get doctor leaves
      const leaves = await DoctorLeave.findAll({
        where: {
          staff_id: doctorId,
          status: 'approved',
          [Op.or]: [
            { start_date: { [Op.between]: [start, end] } },
            { end_date: { [Op.between]: [start, end] } },
          ],
        },
      });

      // get exisiting appointments
      const appointments = await Appointment.findAll({
        where: {
          doctor_id: doctorId,
          appointment_date: { [Op.between]: [start, end] },
          status: { [Op.notIn]: ['cancelled', 'no_show'] },
        },
        attributes: ['appointment_date', 'start_time', 'end_time'],
      });

      const availableSlots = this.generateAvailableSlots(
        schedules,
        leaves,
        appointments,
        start,
        end
      );

      return { availableSlots };
    } catch (error) {
      console.log('Get doctor availability error: ', error);
      throw error;
    }
  }

  async getDepartmentAvailability(
    departmentId,
    startDate = null,
    endDate = null
  ) {
    try {
      const today = startOfDay(new Date());
      const start = startDate ? parseISO(startDate) : addMonths(today, 3);
      const end = endDate ? parseISO(endDate) : addMonths(today, 3);

      // Get all active doctors in department (staff with role='doctor')
      const doctors = await Staff.findAll({
        where: {
          department_id: departmentId,
          role: 'doctor',
          employment_status: 'active',
        },
        include: [
          {
            model: Person,
            as: 'person',
            attributes: ['first_name', 'last_name'],
          },
        ],
        attributes: ['staff_id', 'staff_uuid', 'specialization'],
      });

      if (doctors.length === 0) {
        return [];
      }

      // Get availability for each doctor
      const allSchedules = await Promise.all(
        doctors.map(async doctor => {
          const availability = await this.getDoctorAvailability(
            doctor.staff_uuid,
            format(start, 'yyyy-MM-dd'),
            format(end, 'yyyy-MM-dd')
          );

          const slotWithDoctor = availability.availableSlots.map(slot => ({
            ...slot,
            doctor_id: doctor.staff_id,
            doctor_uuid: doctor.staff_uuid,
            doctor_name: `${doctor.person.first_name} ${doctor.person.last_name}`,
            specialization: doctor.specialization,
          }));

          return {
            doctor: {
              staff_id: doctor.staff_id,
              staff_uuid: doctor.staff_uuid,
              name: `${doctor.person.first_name} ${doctor.person.last_name}`,
              specialization: doctor.specialization,
            },
            availableSlots: slotWithDoctor,
          };
        })
      );

      return allSchedules;
    } catch (error) {
      console.error('Get department availability error:', error);
      throw new AppError('Failed to get department availability', 500);
    }
  }

  // generate available time slots
  generateAvailableSlots(schedules, leaves, appointments, startDate, endDate) {
    const slots = [];
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    days.forEach(day => {
      const dayOfWeek = day.getDay();
      const dateStr = format(day, 'yyyy-MM-dd');

      // Check if doctor has schedule for this day
      const daySchedules = schedules.filter(
        sched => dayMap[sched.day_of_week] === dayOfWeek
      );

      if (daySchedules.length === 0) return;

      const isOnLeave = leaves.some(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);

        return day >= leaveStart && day <= leaveEnd;
      });

      if (isOnLeave) return;

      // generate timeslots for schedules
      daySchedules.forEach(schedule => {
        const timeSlots = this.generateTimeSlots(
          schedule.start_time,
          schedule.end_time,
          30 // 30mins
        );
        // filter out booked slots
        const bookedSlots = appointments
          .filter(apt => apt.appointment_date === dateStr)
          .map(apt => apt.start_time);

        const availableTimeSlots = timeSlots.filter(
          slot => !bookedSlots.includes(slot)
        );

        availableTimeSlots.forEach(time => {
          slots.push({
            date: dateStr,
            time: time,
            day_of_week: schedule.day_of_week,
          });
        });
      });
    });

    return slots;
  }

  generateTimeSlots(startTime, endTime, intervalMinutes = 30) {
    const slots = [];
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let current = new Date();
    current.setHours(startHour, startMinute, 0, 0);

    const end = new Date();
    end.setHours(endHour, endMinute, 0, 0);

    while (current < end) {
      slots.push(format(current, 'HH:mm:ss'));
      current = new Date(current.getTime() + intervalMinutes * 60000);
    }

    return slots;
  }
}

export default new DoctorService();
