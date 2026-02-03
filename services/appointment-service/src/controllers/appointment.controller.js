import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import appointmentService from '../services/appointment.service.js';

// Book new appointment
export const bookAppointment = asyncHandler(async (req, res) => {
  const isStaff = req.user?.staff_id ? true : false;

  const appointmentData = {
    ...req.body,
    doctor_uuid: req.body.doctor_uuid,
    created_by_uuid: isStaff ? req.user.staff_id : req.user.user_id,
    created_by_type: req.user.role,
  };

  const appointment = await appointmentService.bookAppointment(
    appointmentData,
    req,
  );

  messageSender(201, 'Appointment booked successfully', appointment, res);
});

// Get appointment by ID
export const getAppointmentById = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const appointment =
    await appointmentService.getAppointmentById(appointmentId);

  messageSender(200, 'Appointment retrieved successfully', appointment, res);
});

// Get patient's appointments
export const getPatientAppointments = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;
  const filters = req.query;

  const result = await appointmentService.getPatientAppointments(
    patientUuid,
    filters,
  );

  messageSender(
    200,
    'Patient appointments retrieved successfully',
    result,
    res,
  );
});

export const getDoctorAppointments = asyncHandler(async (req, res) => {
  const { doctorUuid } = req.params;
  const filters = req.query;
  console.log('called');
  const result = await appointmentService.getDoctorAppointments(
    doctorUuid,
    filters,
  );
  messageSender(
    200,
    'Doctor appointments retrieved successfully.',
    result,
    res,
  );
});
// Get today's appointments
export const getTodaysAppointments = asyncHandler(async (req, res) => {
  const filters = req.query;
  const role = req.user.role;

  const appointments = await appointmentService.getTodaysAppointments(
    filters,
    role,
  );

  messageSender(
    200,
    "Today's appointments retrieved successfully",
    appointments,
    res,
  );
});

// Reschedule appointment
export const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const { new_date, new_time } = req.body;
  const changedBy = req.user?.staff_uuid || req.user?.user_uuid;

  const appointment = await appointmentService.rescheduleAppointment(
    appointmentId,
    new_date,
    new_time,
    changedBy,
  );

  messageSender(200, 'Appointment rescheduled successfully', appointment, res);
});

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { newStatus } = req.body;
  const { appointmentId } = req.params;
  const updatedBy = req.user.user_id;
  console.log(appointmentId);

  const response = await appointmentService.updateAppointmentStatus(
    appointmentId,
    newStatus,
    updatedBy,
  );

  messageSender(200, 'Updated successfully.', response, res);
});

// Extend appointment duration
export const extendAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const { additional_minutes } = req.body;
  const updatedBy = req.user?.staff_uuid || req.user?.user_uuid;

  const appointment = await appointmentService.extendAppointment(
    appointmentId,
    additional_minutes,
    updatedBy,
  );

  messageSender(200, 'Appointment extended successfully', appointment, res);
});

// Complete appointment
export const completeAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const { notes } = req.body;
  const completedBy = req.user?.user_id || req.user?.staff_id;

  const appointment = await appointmentService.completeAppointment(
    appointmentId,
    notes,
    completedBy,
  );

  messageSender(200, 'Appointment completed successfully', appointment, res);
});

// Process payment
export const processPayment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const paymentData = {
    ...req.body,
    processed_by: req.user?.staff_uuid,
  };

  const payment = await appointmentService.processPayment(
    appointmentId,
    paymentData,
  );

  messageSender(200, 'Payment processed successfully', payment, res);
});

// Get appointment history
export const getAppointmentHistory = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const history = await appointmentService.getAppointmentHistory(appointmentId);

  messageSender(
    200,
    'Appointment history retrieved successfully',
    history,
    res,
  );
});

// Calculate fee
export const calculateFee = asyncHandler(async (req, res) => {
  const { doctor_id, department_id, appointment_type, duration_minutes } =
    req.query;

  const pricing = await appointmentService.calculateAppointmentFee(
    doctor_id,
    department_id,
    appointment_type || 'consultation',
    duration_minutes ? parseInt(duration_minutes) : 30,
  );

  messageSender(200, 'Fee calculated successfully', pricing, res);
});

// Appointment types
export const appointmentTypes = asyncHandler(async (req, res) => {
  const types = await appointmentService.getAppointmentTypes();

  messageSender(200, 'Fetched successfully.', types, res);
});

export const getAllSlotsForDate = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const filters = req.query;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('Invalid date format. Use yyyy-MM-dd', 400);
  }

  const slots = await appointmentService.getAllSlotsForDate(date, filters);

  messageSender(200, 'Slots fetched successfully', slots, res);
});

// Get slot summary for date range (for calendar view)
export const getSlotsSummary = asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  console.log('date');
  if (!start_date || !end_date) {
    throw new AppError('start_date and end_date are required', 400);
  }

  // Validate date formats
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
  ) {
    throw new AppError('Invalid date format. Use yyyy-MM-dd', 400);
  }

  const summary = await appointmentService.getSlotsSummaryForRange(
    start_date,
    end_date,
  );

  messageSender(200, 'Slot summary fetched successfully', summary, res);
});

// Get appointments by date (for day view)
export const getAppointmentsByDate = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { status, department_id, doctor_uuid, appointment_type } = req.query;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('Invalid date format. Use yyyy-MM-dd', 400);
  }

  const appointments = await appointmentService.getAppointmentsByDate(date, {
    status,
    department_id: department_id ? parseInt(department_id) : null,
    doctor_uuid,
    appointment_type,
  });

  messageSender(
    200,
    'Appointments fetched successfully',
    { date, appointments },
    res,
  );
});

// Get daily statistics for receptionist dashboard
export const getDailyStatistics = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new AppError('Invalid date format. Use yyyy-MM-dd', 400);
  }

  const statistics = await appointmentService.getDailyStatistics(targetDate);

  messageSender(200, 'Statistics fetched successfully', statistics, res);
});
