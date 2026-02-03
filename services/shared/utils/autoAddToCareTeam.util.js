import { PatientCareTeam } from '../models/index.js';

/**
 * Care Team Management Helper
 *
 * Handles automatic and manual assignment of staff (doctors, nurses) to patient care teams.
 *
 * - Doctors are auto-added when appointments/admissions are created
 * - Nurses must be manually assigned by authorized staff
 */

/**
 * Automatically add doctor to patient's care team when appointment is created
 * @param {Object} appointment - Appointment object
 * @param {Number} createdBy - User ID who created the appointment
 */
export async function autoAddDoctorToCareTeam(appointment, createdBy) {
  try {
    const { patient_id, doctor_id } = appointment;

    // Skip if no doctor assigned
    if (!doctor_id) return;

    // Check if already on care team
    const isOnTeam = await PatientCareTeam.isOnCareTeam(patient_id, doctor_id);

    if (isOnTeam) {
      console.log(
        `Doctor ${doctor_id} already on care team for patient ${patient_id}`,
      );
      return;
    }

    // Add doctor to care team as primary physician
    await PatientCareTeam.addToTeam(
      patient_id,
      doctor_id,
      'primary_physician', // Doctor role
      createdBy,
      `Auto-added through appointment #${appointment.appointment_id}`,
    );

    console.log(
      `✅ Added doctor ${doctor_id} to care team for patient ${patient_id}`,
    );
  } catch (error) {
    console.error('Error auto-adding doctor to care team:', error);
    // Don't throw - this shouldn't block appointment creation
  }
}

/**
 * Auto-add doctor to care team on admission
 * @param {Object} admission - Admission object
 * @param {Number} createdBy - User ID who created the admission
 */
export async function autoAddDoctorToCareTeamOnAdmission(admission, createdBy) {
  try {
    const { patient_id, attending_doctor_id } = admission;

    // Skip if no doctor assigned
    if (!attending_doctor_id) return;

    // Check if already on care team
    const isOnTeam = await PatientCareTeam.isOnCareTeam(
      patient_id,
      attending_doctor_id,
    );

    if (isOnTeam) {
      console.log(
        `Doctor ${attending_doctor_id} already on care team for patient ${patient_id}`,
      );
      return;
    }

    // Add doctor to care team
    await PatientCareTeam.addToTeam(
      patient_id,
      attending_doctor_id,
      'primary_physician', // Doctor role
      createdBy,
      `Auto-added through admission #${admission.admission_id}`,
    );

    console.log(
      `✅ Added doctor ${attending_doctor_id} to care team for patient ${patient_id}`,
    );
  } catch (error) {
    console.error('Error auto-adding doctor to care team on admission:', error);
    // Don't throw - this shouldn't block admission creation
  }
}

/**
 * Manually add nurse to patient's care team
 * Must be called by authorized staff (doctors, head nurses, admins)
 *
 * @param {Number} patientId - Patient ID
 * @param {Number} nurseStaffId - Nurse's staff ID
 * @param {Number} assignedBy - User ID of person assigning
 * @param {String} reason - Reason for assignment
 * @returns {Object} Care team assignment
 */
export async function addNurseToCareTeam(
  patientId,
  nurseStaffId,
  assignedBy,
  reason = 'Assigned to patient care',
) {
  try {
    // Check if already on care team
    const isOnTeam = await PatientCareTeam.isOnCareTeam(
      patientId,
      nurseStaffId,
    );

    if (isOnTeam) {
      console.log(
        `Nurse ${nurseStaffId} already on care team for patient ${patientId}`,
      );
      return null;
    }

    // Add nurse to care team
    const assignment = await PatientCareTeam.addToTeam(
      patientId,
      nurseStaffId,
      'primary_nurse', // Nurse role
      assignedBy,
      reason,
    );

    console.log(
      `✅ Added nurse ${nurseStaffId} to care team for patient ${patientId}`,
    );

    return assignment;
  } catch (error) {
    console.error('Error adding nurse to care team:', error);
    throw error;
  }
}

/**
 * Remove nurse from patient's care team
 *
 * @param {Number} patientId - Patient ID
 * @param {Number} nurseStaffId - Nurse's staff ID
 * @returns {Boolean} Success
 */
export async function removeNurseFromCareTeam(patientId, nurseStaffId) {
  try {
    const removed = await PatientCareTeam.removeFromTeam(
      patientId,
      nurseStaffId,
    );

    if (removed) {
      console.log(
        `✅ Removed nurse ${nurseStaffId} from care team for patient ${patientId}`,
      );
    } else {
      console.log(
        `Nurse ${nurseStaffId} was not on care team for patient ${patientId}`,
      );
    }

    return removed;
  } catch (error) {
    console.error('Error removing nurse from care team:', error);
    throw error;
  }
}

/**
 * Bulk assign nurse to multiple patients
 * Useful for ward/floor assignments
 *
 * @param {Array} patientIds - Array of patient IDs
 * @param {Number} nurseStaffId - Nurse's staff ID
 * @param {Number} assignedBy - User ID of person assigning
 * @param {String} reason - Reason for assignments
 * @returns {Object} Results
 */
export async function bulkAssignNurseToPatients(
  patientIds,
  nurseStaffId,
  assignedBy,
  reason = 'Bulk ward assignment',
) {
  const results = {
    success: [],
    skipped: [],
    failed: [],
  };

  for (const patientId of patientIds) {
    try {
      const assignment = await addNurseToCareTeam(
        patientId,
        nurseStaffId,
        assignedBy,
        reason,
      );

      if (assignment) {
        results.success.push(patientId);
      } else {
        results.skipped.push(patientId); // Already assigned
      }
    } catch (error) {
      results.failed.push({ patientId, error: error.message });
    }
  }

  console.log(
    `Bulk assignment completed: ${results.success.length} assigned, ${results.skipped.length} skipped, ${results.failed.length} failed`,
  );

  return results;
}

/**
 * Transfer patient from one nurse to another
 *
 * @param {Number} patientId - Patient ID
 * @param {Number} oldNurseStaffId - Current nurse's staff ID
 * @param {Number} newNurseStaffId - New nurse's staff ID
 * @param {Number} assignedBy - User ID of person making transfer
 * @param {String} reason - Reason for transfer
 * @returns {Object} Transfer result
 */
export async function transferPatientToNewNurse(
  patientId,
  oldNurseStaffId,
  newNurseStaffId,
  assignedBy,
  reason = 'Shift change',
) {
  try {
    // Remove old nurse
    await PatientCareTeam.removeFromTeam(patientId, oldNurseStaffId);

    // Add new nurse
    const assignment = await PatientCareTeam.addToTeam(
      patientId,
      newNurseStaffId,
      'primary_nurse',
      assignedBy,
      reason,
    );

    console.log(
      `✅ Transferred patient ${patientId} from nurse ${oldNurseStaffId} to nurse ${newNurseStaffId}`,
    );

    return assignment;
  } catch (error) {
    console.error('Error transferring patient to new nurse:', error);
    throw error;
  }
}

export default {
  // Doctor functions (auto)
  autoAddDoctorToCareTeam,
  autoAddDoctorToCareTeamOnAdmission,

  // Nurse functions (manual)
  addNurseToCareTeam,
  removeNurseFromCareTeam,
  bulkAssignNurseToPatients,
  transferPatientToNewNurse,
};
