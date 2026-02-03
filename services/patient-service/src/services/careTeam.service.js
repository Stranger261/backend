import {
  PatientCareTeam,
  Patient,
  Staff,
  Person,
  User,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';

class CareTeamService {
  /**
   * Automatically add doctor to patient's care team when appointment is created
   */
  async autoAddDoctorToCareTeam(appointment, createdBy) {
    try {
      const { patient_id, doctor_id } = appointment;

      // Skip if no doctor assigned
      if (!doctor_id) {
        console.log(
          'No doctor assigned to appointment, skipping care team add',
        );
        return null;
      }

      // Check if already on care team
      const isOnTeam = await PatientCareTeam.isOnCareTeam(
        patient_id,
        doctor_id,
      );

      if (isOnTeam) {
        console.log(
          `Doctor ${doctor_id} already on care team for patient ${patient_id}`,
        );
        return null;
      }

      // Add doctor to care team as primary physician
      const assignment = await PatientCareTeam.addToTeam(
        patient_id,
        doctor_id,
        'primary_physician',
        createdBy,
        `Auto-added through appointment #${appointment.appointment_id}`,
      );

      console.log(
        `✅ Added doctor ${doctor_id} to care team for patient ${patient_id}`,
      );

      return assignment;
    } catch (error) {
      console.error('Error auto-adding doctor to care team:', error.message);
      // Don't throw - this shouldn't block appointment creation
      return null;
    }
  }

  /**
   * Auto-add doctor to care team on admission
   */
  async autoAddDoctorToCareTeamOnAdmission(admission, createdBy) {
    try {
      const { patient_id, attending_doctor_id } = admission;

      // Skip if no doctor assigned
      if (!attending_doctor_id) {
        console.log('No doctor assigned to admission, skipping care team add');
        return null;
      }

      // Check if already on care team
      const isOnTeam = await PatientCareTeam.isOnCareTeam(
        patient_id,
        attending_doctor_id,
      );

      if (isOnTeam) {
        console.log(
          `Doctor ${attending_doctor_id} already on care team for patient ${patient_id}`,
        );
        return null;
      }

      // Add doctor to care team
      const assignment = await PatientCareTeam.addToTeam(
        patient_id,
        attending_doctor_id,
        'primary_physician',
        createdBy,
        `Auto-added through admission #${admission.admission_id}`,
      );

      console.log(
        `✅ Added doctor ${attending_doctor_id} to care team for patient ${patient_id}`,
      );

      return assignment;
    } catch (error) {
      console.error(
        'Error auto-adding doctor to care team on admission:',
        error.message,
      );
      // Don't throw - this shouldn't block admission creation
      return null;
    }
  }

  /**
   * Manually add nurse to patient's care team
   */
  async assignNurseToPatient({
    patientUuid,
    nurseStaffUuid,
    assignedBy,
    reason,
  }) {
    try {
      // Validate patient
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Validate nurse
      const nurse = await Staff.findOne({
        where: { staff_uuid: nurseStaffUuid },
      });

      if (!nurse) {
        throw new AppError('Nurse not found', 404);
      }

      // Check if already on care team
      const isOnTeam = await PatientCareTeam.isOnCareTeam(
        patient.patient_id,
        nurse.staff_id,
      );

      if (isOnTeam) {
        throw new AppError('Nurse already assigned to this patient', 409);
      }

      // Add nurse to care team
      const assignment = await PatientCareTeam.addToTeam(
        patient.patient_id,
        nurse.staff_id,
        'primary_nurse',
        assignedBy,
        reason || 'Assigned to patient care',
      );

      console.log(
        `✅ Added nurse ${nurse.staff_id} to care team for patient ${patient.patient_id}`,
      );

      return {
        care_team_id: assignment.care_team_id,
        patient_id: assignment.patient_id,
        staff_id: assignment.staff_id,
        role_in_care: assignment.role_in_care,
        start_date: assignment.start_date,
        assignment_reason: assignment.assignment_reason,
      };
    } catch (error) {
      console.error('Error assigning nurse to patient:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to assign nurse to patient', 500);
    }
  }

  /**
   * Remove nurse from patient's care team
   */
  async removeNurseFromPatient({ patientUuid, nurseStaffUuid }) {
    try {
      // Validate patient
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Validate nurse
      const nurse = await Staff.findOne({
        where: { staff_uuid: nurseStaffUuid },
      });

      if (!nurse) {
        throw new AppError('Nurse not found', 404);
      }

      // Remove nurse from care team
      const removed = await PatientCareTeam.removeFromTeam(
        patient.patient_id,
        nurse.staff_id,
      );

      if (!removed) {
        throw new AppError('Nurse was not assigned to this patient', 404);
      }

      console.log(
        `✅ Removed nurse ${nurse.staff_id} from care team for patient ${patient.patient_id}`,
      );

      return { removed: true };
    } catch (error) {
      console.error('Error removing nurse from patient:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to remove nurse from patient', 500);
    }
  }

  /**
   * Bulk assign nurse to multiple patients
   */
  async bulkAssignNurseToPatients({
    patientUuids,
    nurseStaffUuid,
    assignedBy,
    reason,
  }) {
    try {
      if (!Array.isArray(patientUuids) || patientUuids.length === 0) {
        throw new AppError('Patient UUIDs array is required', 400);
      }

      // Validate nurse
      const nurse = await Staff.findOne({
        where: { staff_uuid: nurseStaffUuid },
      });

      if (!nurse) {
        throw new AppError('Nurse not found', 404);
      }

      // Get patients from UUIDs
      const patients = await Patient.findAll({
        where: { patient_uuid: patientUuids },
        attributes: ['patient_id', 'patient_uuid'],
      });

      const results = {
        success: [],
        skipped: [],
        failed: [],
      };

      // Assign to each patient
      for (const patient of patients) {
        try {
          // Check if already on care team
          const isOnTeam = await PatientCareTeam.isOnCareTeam(
            patient.patient_id,
            nurse.staff_id,
          );

          if (isOnTeam) {
            results.skipped.push({
              patient_uuid: patient.patient_uuid,
              reason: 'Already assigned',
            });
            continue;
          }

          // Add to care team
          await PatientCareTeam.addToTeam(
            patient.patient_id,
            nurse.staff_id,
            'primary_nurse',
            assignedBy,
            reason || 'Bulk ward assignment',
          );

          results.success.push(patient.patient_uuid);
        } catch (error) {
          results.failed.push({
            patient_uuid: patient.patient_uuid,
            error: error.message,
          });
        }
      }

      console.log(
        `Bulk assignment completed: ${results.success.length} assigned, ${results.skipped.length} skipped, ${results.failed.length} failed`,
      );

      return results;
    } catch (error) {
      console.error('Error in bulk assignment:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to bulk assign nurse', 500);
    }
  }

  /**
   * Transfer patient from one nurse to another
   */
  async transferPatientNurse({
    patientUuid,
    oldNurseStaffUuid,
    newNurseStaffUuid,
    assignedBy,
    reason,
  }) {
    try {
      // Validate patient
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Validate old nurse
      const oldNurse = await Staff.findOne({
        where: { staff_uuid: oldNurseStaffUuid },
      });

      if (!oldNurse) {
        throw new AppError('Old nurse not found', 404);
      }

      // Validate new nurse
      const newNurse = await Staff.findOne({
        where: { staff_uuid: newNurseStaffUuid },
      });

      if (!newNurse) {
        throw new AppError('New nurse not found', 404);
      }

      // Remove old nurse
      await PatientCareTeam.removeFromTeam(
        patient.patient_id,
        oldNurse.staff_id,
      );

      // Add new nurse
      const assignment = await PatientCareTeam.addToTeam(
        patient.patient_id,
        newNurse.staff_id,
        'primary_nurse',
        assignedBy,
        reason || 'Nurse transfer',
      );

      console.log(
        `✅ Transferred patient ${patient.patient_id} from nurse ${oldNurse.staff_id} to nurse ${newNurse.staff_id}`,
      );

      return {
        care_team_id: assignment.care_team_id,
        patient_id: assignment.patient_id,
        staff_id: assignment.staff_id,
        role_in_care: assignment.role_in_care,
        start_date: assignment.start_date,
        assignment_reason: assignment.assignment_reason,
      };
    } catch (error) {
      console.error('Error transferring patient nurse:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to transfer patient nurse', 500);
    }
  }

  /**
   * Get patient's current care team
   */
  async getPatientCareTeam(patientUuid) {
    try {
      // Validate patient
      const patient = await Patient.findOne({
        where: { patient_uuid: patientUuid },
      });

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Get care team
      const careTeam = await PatientCareTeam.getActiveCareTeam(
        patient.patient_id,
      );

      // Enrich with staff details
      const enrichedCareTeam = await Promise.all(
        careTeam.map(async member => {
          const staff = await Staff.findByPk(member.staff_id, {
            include: [
              {
                model: Person,
                as: 'person',
                attributes: ['first_name', 'middle_name', 'last_name'],
              },
            ],
          });

          // Get assigner details
          let assignerName = 'System';
          if (member.assigned_by) {
            const assigner = await User.findByPk(member.assigned_by, {
              include: [
                {
                  model: Person,
                  as: 'person',
                  attributes: ['first_name', 'last_name'],
                },
              ],
            });

            if (assigner && assigner.person) {
              assignerName = `${assigner.person.first_name} ${assigner.person.last_name}`;
            }
          }

          return {
            care_team_id: member.care_team_id,
            staff_id: member.staff_id,
            staff_uuid: staff?.staff_uuid || null,
            role_in_care: member.role_in_care,
            start_date: member.start_date,
            end_date: member.end_date,
            assignment_reason: member.assignment_reason,
            staff_name: staff
              ? `${staff.person.first_name} ${staff.person.last_name}`
              : 'Unknown',
            assigned_by: assignerName,
            is_active: member.is_active,
          };
        }),
      );

      return enrichedCareTeam;
    } catch (error) {
      console.error('Error getting patient care team:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get patient care team', 500);
    }
  }
}

export default new CareTeamService();
