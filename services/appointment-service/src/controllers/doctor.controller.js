import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import doctorService from '../services/doctor.service.js';

export const getDepartments = asyncHandler(async (req, res) => {
  const departments = await doctorService.getAllDepartments();
  messageSender(200, 'Departments retrieved successfully.', departments, res);
});

export const getAllDoctors = asyncHandler(async (req, res) => {
  const doctors = await doctorService.getAllDoctors();
  messageSender(200, 'Doctors retrieved successfully.', doctors, res);
});

// need to know since i have to know who is the user then go to person then map person to get the patient
export const getDoctorsByDepartment = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  const { patientUuid } = req.query;

  const doctors = await doctorService.getDoctorsByDepartment(
    departmentId,
    patientUuid
  );
  messageSender(200, 'Doctors retrieved successfully.', doctors, res);
});

export const getDoctorAvailability = asyncHandler(async (req, res) => {
  const { doctorUuid } = req.params;
  const { startDate, endDate } = req.query;

  const availability = await doctorService.getDoctorAvailability(
    doctorUuid,
    startDate,
    endDate
  );
  messageSender(
    200,
    'Doctor availability retrieved successfully.',
    availability,
    res
  );
});

export const getDepartmentAvailability = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  const { startDate, endDate } = req.query;

  const availability = await doctorService.getDepartmentAvailability(
    departmentId,
    startDate,
    endDate
  );

  messageSender(
    200,
    'Department availability retrieved successfully.',
    availability,
    res
  );
});
