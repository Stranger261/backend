import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import careTeamService from '../services/careTeam.service.js';

/**
 * Assign nurse to patient
 * Route: POST /api/care-team/assign-nurse
 */
export const assignNurseToPatient = asyncHandler(async (req, res) => {
  const { patientUuid, nurseStaffUuid, reason } = req.body;
  const assignedBy = req.user.user_id;

  const assignment = await careTeamService.assignNurseToPatient({
    patientUuid,
    nurseStaffUuid,
    assignedBy,
    reason,
  });

  messageSender(200, 'Nurse assigned to patient successfully', assignment, res);
});

/**
 * Remove nurse from patient
 * Route: DELETE /api/care-team/remove-nurse
 */
export const removeNurseFromPatient = asyncHandler(async (req, res) => {
  const { patientUuid, nurseStaffUuid } = req.body;

  const result = await careTeamService.removeNurseFromPatient({
    patientUuid,
    nurseStaffUuid,
  });

  messageSender(200, 'Nurse removed from patient successfully', result, res);
});

/**
 * Bulk assign nurse to multiple patients
 * Route: POST /api/care-team/bulk-assign-nurse
 */
export const bulkAssignNurse = asyncHandler(async (req, res) => {
  const { patientUuids, nurseStaffUuid, reason } = req.body;
  const assignedBy = req.user.user_id;

  const results = await careTeamService.bulkAssignNurseToPatients({
    patientUuids,
    nurseStaffUuid,
    assignedBy,
    reason,
  });

  messageSender(200, 'Bulk assignment completed', results, res);
});

/**
 * Transfer patient from one nurse to another
 * Route: PUT /api/care-team/transfer-nurse
 */
export const transferPatientNurse = asyncHandler(async (req, res) => {
  const { patientUuid, oldNurseStaffUuid, newNurseStaffUuid, reason } =
    req.body;
  const assignedBy = req.user.user_id;

  const assignment = await careTeamService.transferPatientNurse({
    patientUuid,
    oldNurseStaffUuid,
    newNurseStaffUuid,
    assignedBy,
    reason,
  });

  messageSender(
    200,
    'Patient transferred to new nurse successfully',
    assignment,
    res,
  );
});

/**
 * Get patient's current care team
 * Route: GET /api/care-team/patient/:patientUuid
 */
export const getPatientCareTeam = asyncHandler(async (req, res) => {
  const { patientUuid } = req.params;

  const careTeam = await careTeamService.getPatientCareTeam(patientUuid);

  messageSender(200, 'Care team retrieved successfully', careTeam, res);
});

/**
 * Auto-add doctor to care team (called from appointment/admission creation)
 * This is not a route handler - used internally by other controllers
 */
export const autoAddDoctorToCareTeam = async (appointment, createdBy) => {
  return await careTeamService.autoAddDoctorToCareTeam(appointment, createdBy);
};

/**
 * Auto-add doctor to care team on admission
 * This is not a route handler - used internally by other controllers
 */
export const autoAddDoctorToCareTeamOnAdmission = async (
  admission,
  createdBy,
) => {
  return await careTeamService.autoAddDoctorToCareTeamOnAdmission(
    admission,
    createdBy,
  );
};
