import { Op } from 'sequelize';
import { SOCKET_ROOMS } from '../../../shared/helpers/bedSocket.helper.js';
import {
  sequelize,
  Bed,
  BedAssignment,
  Room,
  BedStatusLog,
  Admission,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';
import {
  emitAdmissionDischarged,
  emitBedAssigned,
  emitBedReleased,
  emitBedStatusChanged,
  emitToRoom,
} from '../../../shared/utils/socketEmitter.js';

class BedAssignmentService {
  // main method for admissions
  async assignBedToAdmission(
    admissionId,
    bedId,
    assignedBy,
    externalTransaction = null,
  ) {
    // Use external transaction if provided (for cross-service calls)
    const transaction = externalTransaction || (await sequelize.transaction());
    const shouldCommit = !externalTransaction; // Only commit if we created the transaction

    try {
      const bed = await Bed.findByPk(bedId, { transaction });

      if (!bed) {
        throw new AppError('Bed not found.', 404);
      }

      if (bed.bed_status !== 'available') {
        throw new AppError(
          `Bed ${bed.bed_number} is currently ${bed.bed_status}. Please select an available bed.`,
          400,
        );
      }

      const existingAssignment = await BedAssignment.findOne({
        where: { admission_id: admissionId, is_current: true },
        transaction,
      });

      if (existingAssignment) {
        await this.releaseOldBedForTransfer(
          existingAssignment,
          `Transfer to bed ${bed.bed_number}`,
          transaction,
        );
      }

      const oldStatus = bed.bed_status;

      await bed.update({ bed_status: 'occupied' }, { transaction });

      const assignment = await BedAssignment.create(
        {
          admission_id: admissionId,
          bed_id: bedId,
          assigned_by: assignedBy,
          assigned_at: new Date(),
          is_current: true,
        },
        { transaction },
      );

      // Log status change
      await BedStatusLog.logStatusChange(
        {
          bedId,
          oldStatus,
          newStatus: 'occupied',
          changedBy: assignedBy,
          reason: `Assigned to admission ID: ${admissionId}`,
          admissionId,
          assignmentId: assignment.assignment_id,
        },
        { transaction },
      );

      const fullAssignment = await BedAssignment.findByPk(
        assignment.assignment_id,
        {
          include: [
            {
              model: Bed,
              as: 'bed',
              include: [
                {
                  model: Room,
                  as: 'room',
                },
              ],
            },
          ],
          transaction,
        },
      );

      if (shouldCommit) {
        await transaction.commit();
      }

      await emitBedAssigned({
        bed_id: bedId,
        bed_number: fullAssignment.bed.bed_number,
        admission_id: admissionId,
        assignment_id: assignment.assignment_id,
        old_status: oldStatus,
        new_status: 'occupied',
        room: {
          room_id: fullAssignment.bed.room.room_id,
          room_number: fullAssignment.bed.room.room_number,
          floor_number: fullAssignment.bed.room.floor_number,
        },
        assigned_by: assignedBy,
        assigned_at: assignment.assigned_at,
      });

      return fullAssignment;
    } catch (error) {
      if (shouldCommit && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Assign bed failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to assign bed.', 500);
    }
  }

  async releaseOldBedForTransfer(existingAssignment, reason, transaction) {
    try {
      const bed = await Bed.findByPk(existingAssignment.bed_id, {
        include: [{ model: Room, as: 'room' }],
        transaction,
      });

      const oldStatus = bed.bed_status;

      await existingAssignment.update(
        {
          is_current: false,
          released_at: new Date(),
          transfer_reason: reason,
        },
        { transaction },
      );

      // Set old bed to cleaning
      await bed.update({ bed_status: 'cleaning' }, { transaction });

      await BedStatusLog.create(
        {
          bed_id: bed.bed_id,
          old_status: oldStatus,
          new_status: 'cleaning',
          changed_by: existingAssignment.assigned_by,
          change_reason: reason,
          admission: existingAssignment.admission_id,
          assignment_id: existingAssignment.assignment_id,
        },
        { transaction },
      );

      return { bed, oldAssignment: existingAssignment };
    } catch (error) {
      console.error('Failed to release old bed for transfer:', error.message);
      throw new AppError('Failed to release old bed for transfer.', 500);
    }
  }

  // release bed from admission
  async releaseBedFromAdmission(
    admissionId,
    reason = null,
    dischargeType = 'routine',
    dischargeSummary = '',
    externalTransaction = null,
  ) {
    const transaction = externalTransaction || (await sequelize.transaction());
    const shouldCommit = !externalTransaction;
    try {
      // Find the admission
      const admission = await Admission.findOne({
        where: { admission_id: admissionId },
        transaction,
      });

      if (!admission) {
        throw new AppError('Admission not found.', 404);
      }

      // Check if already discharged
      if (
        admission.admission_status === 'discharged' ||
        admission.admission_status === 'deceased'
      ) {
        throw new AppError('Patient has already been discharged.', 400);
      }

      // Find the active bed assignment
      const assignment = await BedAssignment.findOne({
        where: { admission_id: admissionId, is_current: true },
        transaction,
      });

      if (!assignment) {
        throw new AppError(
          'No active bed assignment found for this admission.',
          404,
        );
      }

      const bed = await Bed.findOne({
        where: { bed_id: assignment.bed_id },
        include: [{ model: Room, as: 'room' }],
        transaction,
      });

      if (!bed) {
        throw new AppError('Bed not found.', 404);
      }

      const oldStatus = bed.bed_status;
      const dischargeDate = new Date();

      //  Calculate length of stay
      const admissionDate = new Date(admission.admission_date);
      const lengthOfStayDays = Math.ceil(
        (dischargeDate - admissionDate) / (1000 * 60 * 60 * 24),
      );

      // Update admission record
      await admission.update(
        {
          admission_status:
            dischargeType === 'deceased' ? 'deceased' : 'discharged',
          discharge_date: dischargeDate,
          discharge_type: dischargeType,
          discharge_summary: dischargeSummary,
          length_of_stay_days: lengthOfStayDays,
        },
        { transaction },
      );

      // Release bed assignment
      await assignment.update(
        {
          is_current: false,
          released_at: dischargeDate,
          transfer_reason: reason || `Patient discharged - ${dischargeType}`,
        },
        { transaction },
      );

      // Update bed status
      await bed.update({ bed_status: 'cleaning' }, { transaction });

      if (shouldCommit) {
        await transaction.commit();
      }

      // Log status change
      await BedStatusLog.logStatusChange({
        bedId: assignment.bed_id,
        oldStatus,
        newStatus: 'cleaning',
        changedBy: assignment.assigned_by,
        reason: reason || `Patient discharged - ${dischargeType}`,
        admissionId,
        assignmentId: assignment.assignment_id,
      });

      //  Emit events
      await emitBedReleased({
        bed_id: bed.bed_id,
        bed_number: bed.bed_number,
        admission_id: admissionId,
        old_status: oldStatus,
        new_status: 'cleaning',
        room: {
          room_id: bed.room.room_id,
          room_number: bed.room.room_number,
          floor_number: bed.room.floor_number,
        },
        released_at: dischargeDate,
        reason: reason || `Patient discharged - ${dischargeType}`,
      });

      // Emit admission discharged event (if you have one)
      await emitAdmissionDischarged({
        admission_id: admissionId,
        patient_id: admission.patient_id,
        discharge_date: dischargeDate,
        discharge_type: dischargeType,
        length_of_stay_days: lengthOfStayDays,
      });

      return {
        admission,
        assignment,
        bed,
        lengthOfStayDays,
      };
    } catch (error) {
      if (shouldCommit && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Release bed failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to discharge patient.', 500);
    }
  }
  // transfer patient to different bed
  async transferBed(admissionId, newBedId, assignedBy, reason = null) {
    const transaction = await sequelize.transaction();
    try {
      const currentAssignment = await BedAssignment.findOne({
        where: { admission_id: admissionId, is_current: true },
        include: [
          {
            model: Bed,
            as: 'bed',
            include: [{ model: Room, as: 'room' }],
          },
        ],
        transaction,
      });

      if (!currentAssignment) {
        throw new AppError('No admission found.', 404);
      }

      const oldBedData = {
        bed_id: currentAssignment.bed.bed_id,
        bed_number: currentAssignment.bed.bed_number,
        room: currentAssignment.bed.room,
      };

      const newAssignment = await this.assignBedToAdmission(
        admissionId,
        newBedId,
        assignedBy,
        transaction,
      );

      await newAssignment.update(
        {
          transfer_reason: reason,
        },
        { transaction },
      );
      await transaction.commit();

      await emitToRoom(
        SOCKET_ROOMS.BED_MANAGEMENT,
        SOCKET_ROOMS.BED_TRANSFERRED,
        {
          admission_id: admissionId,
          old_bed: oldBedData,
          new_bed: {
            bed_id: newAssignment.bed.bed_id,
            bed_number: newAssignment.bed.bed_number,
            room: newAssignment.bed.room,
          },
          reason,
          transferred_by: assignedBy,
          transferred_at: new Date(),
        },
      );
      return newAssignment;
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Transfer bed failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to transfer bed.', 500);
    }
  }

  // get bed assignment
  async getCurrentBedAssignment(admissionId) {
    try {
      const assignment = await BedAssignment.findOne({
        where: { admissionId, is_current: true },
        include: [
          {
            model: Bed,
            as: 'bed',
            include: [
              {
                model: Room,
                as: 'room',
              },
            ],
          },
        ],
      });

      if (!assignment) {
        throw new AppError('No active bed assignment found.', 404);
      }

      return assignment;
    } catch (error) {
      console.error('Get current bed assignment failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get current bed assignment.', 500);
    }
  }

  // get bed assignment history for an admission
  async getBedAssignmentHistory(admissionId) {
    try {
      const history = await BedAssignment.findAll({
        where: {
          admission_id: admissionId,
        },
        include: [
          {
            model: Bed,
            as: 'bed',
            include: [
              {
                model: Room,
                as: 'room',
              },
            ],
          },
        ],
        order: [['assigned_at', 'DESC']],
      });

      return history;
    } catch (error) {
      console.error('Get bed assignment history failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed assignment history.', 500);
    }
  }

  async markBedCleaned(bedId, cleanedBy) {
    const transaction = await sequelize.transaction();

    try {
      const bed = await Bed.findByPk(bedId, {
        include: [{ model: Room, as: 'room' }],
        transaction,
      });

      if (!bed) {
        throw new AppError('Bed not found.', 404);
      }

      if (bed.bed_status !== 'cleaning') {
        throw new AppError(
          `Bed is currently ${bed.bed_status}. Only beds in cleaning status can be marked as cleaned.`,
          400,
        );
      }

      const oldStatus = bed.bed_status;

      await bed.update(
        {
          bed_status: 'available',
          last_cleaned_at: new Date(),
        },
        { transaction },
      );

      // Log status change
      await BedStatusLog.logStatusChange(
        {
          bedId,
          oldStatus,
          newStatus: 'available',
          changedBy: cleanedBy,
          reason: 'Bed cleaned and ready for use',
        },
        { transaction },
      );

      await transaction.commit();

      // 🔴 EMIT REAL-TIME EVENT - Bed Cleaned
      await emitBedStatusChanged({
        bed_id: bedId,
        bed_number: bed.bed_number,
        old_status: oldStatus,
        new_status: 'available',
        room: {
          room_id: bed.room.room_id,
          room_number: bed.room.room_number,
          floor_number: bed.room.floor_number,
        },
        cleaned_by: cleanedBy,
        cleaned_at: new Date(),
      });

      return bed;
    } catch (error) {
      await transaction.rollback();
      console.error('Mark bed cleaned failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to mark bed as cleaned.', 500);
    }
  }

  async getAllAdmissions(filters) {
    try {
      const activeAdmission = await Admission.getAllAdmissions(filters);

      return activeAdmission;
    } catch (error) {
      console.error('Get bed assignment history failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed assignment history.', 500);
    }
  }
}

export default new BedAssignmentService();
