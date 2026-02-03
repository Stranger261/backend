import {
  Bed,
  Room,
  sequelize,
  BedAssignment,
  BedStatusLog,
} from '../../../shared/models/index.js';
import AppError from '../../../shared/utils/AppError.util.js';
import { emitBedStatusChanged } from '../../../shared/utils/socketEmitter.js';

class BedService {
  // Get floor summary
  async getFloorSummary() {
    try {
      const floor = await Bed.getFloorSummary();

      return floor;
    } catch (error) {
      console.error('Get floor summary failed ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get floor summary.', 500);
    }
  }

  // Get room summary for a specific floor
  async getRoomsSummary(floorNumber) {
    try {
      const floor = await Room.findOne({
        where: { floor_number: floorNumber },
      });

      if (!floor) {
        throw new AppError('Floor not found.', 404);
      }

      const room = await Bed.getRoomsSummary(floorNumber);

      if (!room) {
        throw new AppError('Room not found.', 404);
      }

      return room;
    } catch (error) {
      console.error('Get room summary failed ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get room summary.', 500);
    }
  }

  // Get beds for a specific room
  async getRoomBeds(roomId) {
    try {
      const room = await Room.findByPk(roomId);

      if (!room) {
        throw new AppError('Room not found.', 404);
      }

      const bed = await Bed.findAll({
        where: { room_id: roomId },
        include: [
          {
            model: Room,
            as: 'room',
            attributes: ['room_number', 'floor_number', 'room_type'],
          },
          {
            model: BedAssignment,
            as: 'assignments',
            where: { is_current: true },
            required: false,
            attributes: ['assignment_id', 'admission_id', 'assigned_at'],
          },
        ],
        order: [['bed_number', 'ASC']],
      });

      return bed;
    } catch (error) {
      console.error('Get bed of specific room failed ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get beds room.', 500);
    }
  }

  // Get available beds with filters
  async getAvailableBed(bedType, floor, roomType) {
    try {
      const beds = await Bed.getBedsWithRoomInfo({
        status: 'available',
        bedType,
        floor: floor ? floor : null,
        roomType,
      });

      if (!beds) {
        throw new AppError('No available bed found.');
      }

      return beds;
    } catch (error) {
      console.error('Get bed available failed ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get available bed.', 500);
    }
  }

  // Get specific bed details
  async getBedDetails(bedId) {
    try {
      const bed = await Bed.findOne({
        where: { bed_id: bedId },
        include: [
          {
            model: Room,
            as: 'room',
            attributes: ['room_id', 'room_number', 'floor_number', 'room_type'],
          },
        ],
      });

      if (!bed) {
        throw new AppError('Bed not found.', 404);
      }

      return bed;
    } catch (error) {
      console.error('Get bed details failed ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed details.', 500);
    }
  }

  // get all beds
  async getAllBeds(filters = {}) {
    try {
      const { status, bedType, floor } = filters;
      const where = {};

      if (status) where.bed_status = status;
      if (bedType) where.bed_type = bedType;

      const beds = await Bed.findAll({
        where,
        include: [
          {
            model: Room,
            as: 'room',
            attributes: ['room_number', 'floor_number', 'room_type'],
            where: floor ? { floor_number: floor } : {},
          },
          {
            model: BedAssignment,
            as: 'assignments',
            where: { is_current: true },
            required: false,
          },
        ],
        order: [
          [{ model: Room, as: 'room' }, 'floor_number', 'ASC'],
          [{ model: Room, as: 'room' }, 'room_number', 'ASC'],
          ['bed_number', 'ASC'],
        ],
      });

      return beds;
    } catch (error) {
      console.error('Get all beds failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get beds.', 500);
    }
  }

  // Update bed status
  async updateBedStatus(bedId, newStatus, reason = null, updatedBy = null) {
    const transaction = await sequelize.transaction();
    try {
      const bed = await Bed.findByPk(bedId, {
        include: [{ model: Room, as: 'room' }],
        transaction,
      });

      if (!bed) {
        throw new AppError('Bed not found.', 404);
      }

      const oldStatus = bed.bed_status;

      // Validate status transitions
      const validTransitions = {
        available: ['maintenance', 'reserved', 'occupied'],
        occupied: ['available', 'cleaning'], // Only through BedAssignment
        cleaning: ['available', 'maintenance'],
        maintenance: ['cleaning', 'available'],
        reserved: ['available', 'occupied'],
      };

      if (!validTransitions[bed.bed_status]?.includes(newStatus)) {
        throw new AppError(
          `Cannot change bed status from ${bed.bed_status} to ${newStatus}.`,
          400,
        );
      }

      // Don't allow manual occupied status - must use BedAssignment
      if (newStatus === 'occupied') {
        throw new AppError(
          'Cannot manually set bed to occupied. Use bed assignment instead.',
          400,
        );
      }

      // Update bed status
      bed.bed_status = newStatus;

      await bed.save({ transaction });

      // Log the status change
      await BedStatusLog.create(
        {
          bed_id: bedId,
          old_status: bed.bed_status,
          new_status: newStatus,
          reason,
          changed_by: updatedBy,
        },
        { transaction },
      );

      await transaction.commit();

      emitBedStatusChanged({
        bed_id: bedId,
        bed_number: bed.bed_number,
        old_status: oldStatus,
        new_status: newStatus,
        room: {
          room_id: bed.room.room_id,
          room_number: bed.room.room_number,
          floor_number: bed.room.floor_number,
        },
        changed_by: updatedBy,
        reason,
        changed_at: new Date(),
      });

      return await this.getBedDetails(bedId);
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Update bed status failed ', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to update bed status.', 500);
    }
  }

  // mark bed as maintenance
  async markBedForMaintenance(bedId, reason, reportedBy) {
    const transaction = await sequelize.transaction();
    try {
      const bed = await this.getBedDetails(bedId);

      if (bed.bed_status === 'occupied') {
        throw new AppError(
          'Cannot mark occupied bed for maintenance. Please transfer patient first.',
          400,
        );
      }

      const oldStatus = bed.bed_status;

      await bed.update(
        {
          bed_status: 'maintenance',
          maintenance_reported_at: new Date(),
        },
        { transaction },
      );

      // Log the status change
      await BedStatusLog.logStatusChange(
        {
          bedId,
          oldStatus,
          newStatus: 'maintenance',
          changedBy: reportedBy,
          reason: reason,
        },
        { transaction },
      );

      await transaction.commit();

      emitBedStatusChanged({
        bed_id: bedId,
        bed_number: bed.bed_number,
        old_status: oldStatus,
        new_status: bed.bed_status,
        room: {
          room_id: bed.room.room_id,
          room_number: bed.room.room_number,
          floor_number: bed.room.floor_number,
        },
        changed_by: reportedBy,
        reason,
        changed_at: new Date(),
      });

      return await this.getBedDetails(bedId);
    } catch (error) {
      console.error('Mark bed for maintenance failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to mark bed for maintenance.', 500);
    }
  }

  // mark bed as cleaned and available
  async markBedCleaned(bedId, cleanedBy) {
    const transaction = await sequelize.transaction();

    try {
      const bed = await Bed.findByPk(bedId, { transaction });

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

      // Log the status change
      await BedStatusLog.logStatusChange({
        bedId,
        oldStatus,
        newStatus: 'available',
        changedBy: cleanedBy,
        reason: 'Bed cleaned and ready for use',
      });

      await transaction.commit();

      emitBedStatusChanged({
        bed_id: bedId,
        bed_number: bed.bed_number,
        old_status: oldStatus,
        new_status: newStatus,
        room: {
          room_id: bed.room.room_id,
          room_number: bed.room.room_number,
          floor_number: bed.room.floor_number,
        },
        changed_by: updatedBy,
        reason,
        changed_at: new Date(),
      });

      return await this.getBedDetails(bedId);
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      console.error('Mark bed cleaned failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to mark bed as cleaned.', 500);
    }
  }

  //Reserve a bed (for planned admissions)
  async reserveBed(bedId, reservedBy, reason) {
    const transaction = await sequelize.transaction();
    try {
      const bed = await Bed.findByPk(bedId, { transaction });

      if (!bed) {
        throw new AppError('Bed not found.', 404);
      }

      if (bed.bed_status !== 'available') {
        throw new AppError(
          `Bed is currently ${bed.bed_status}. Only available beds can be reserved.`,
          400,
        );
      }

      const oldStatus = bed.bed_status;

      await this.updateBedStatus(bedId, 'reserved', reason, reservedBy);

      await transaction.commit();

      emitBedStatusChanged({
        bed_id: bedId,
        bed_number: bed.bed_number,
        old_status: oldStatus,
        new_status: newStatus,
        room: {
          room_id: bed.room.room_id,
          room_number: bed.room.room_number,
          floor_number: bed.room.floor_number,
        },
        changed_by: null,
        reason,
        changed_at: new Date(),
      });

      return await this.getBedDetails(bedId);
    } catch (error) {
      await transaction.rollback();
      console.error('Reserve bed failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to reserve bed.', 500);
    }
  }

  // cancel reserveation
  async cancelBedReservation(bedId, cancelledBy, reason) {
    const transaction = await sequelize.transaction();
    try {
      const bed = await Bed.findByPk(bedId, { transaction });

      if (!bed) {
        throw new AppError('Bed not found.', 404);
      }

      if (bed.bed_status !== 'reserved') {
        throw new AppError('Bed is not reserved.', 400);
      }

      const oldStatus = bed.bed_status;

      await this.updateBedStatus(bedId, 'available', reason, cancelledBy);

      emitBedStatusChanged({
        bed_id: bedId,
        bed_number: bed.bed_number,
        old_status: oldStatus,
        new_status: newStatus,
        room: {
          room_id: bed.room.room_id,
          room_number: bed.room.room_number,
          floor_number: bed.room.floor_number,
        },
        changed_by: null,
        reason,
        changed_at: new Date(),
      });

      return this.getBedDetails(bedId);
    } catch (error) {
      await transaction.rollback();
      console.error('Cancel bed reservation failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to cancel bed reservation.', 500);
    }
  }

  // ========================================================================
  // STATISTICS & REPORTING
  // ========================================================================

  // get bed occupancy statistics
  async getBedOccupancyStats() {
    try {
      const stats = await Bed.findAll({
        attributes: [
          'bed_status',
          sequelize.fn('COUNT', sequelize.col('bed_id')),
          'count',
        ],
        group: ['bed_status'],
        raw: true,
      });

      const total = Bed.count();

      return {
        total,
        breakdown: stats,
        occupancy_rate:
          stats.find(s => s.bed_status === 'occupied')?.count || 0,
        availablity_rate:
          stats.find(s => s.bed_status === 'available')?.count || 0,
      };
    } catch (error) {
      console.error('Get bed occupancy stats failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed occupancy statistics.', 500);
    }
  }

  // get beds requiring attention(cleaning, maintenance)
  async getBedsRequiringAttention() {
    try {
      const beds = await Bed.findAll({
        where: { bed_status: ['cleaning', 'maintenance'] },
        include: [
          {
            model: Room,
            as: 'room',
            attributes: ['room_number', 'floor_number'],
          },
          {
            model: BedStatusLog,
            as: 'statusLogs',
            required: false,
            where: sequelize.literal(`
                statusLogs.log_id = (
                  SELECT bsl2.log_id
                  FROM bed_status_logs bsl2
                  WHERE bsl2.bed_id = Bed.bed_id
                    AND bsl2.new_status = Bed.bed_status
                  ORDER BY bsl2.changed_at DESC
                  LIMIT 1
                )
              `),
            attributes: ['change_reason', 'changed_at', 'changed_by'],
          },
        ],
        order: [
          [
            {
              model: Room,
              as: 'room',
            },
            'floor_number',
            'ASC',
          ],
          ['bed_status', 'DESC'],
        ],
      });

      const mappedBeds = beds.map(bed => {
        const bedData = bed.toJSON();
        const latestLog = bedData.statusLogs?.[0];

        return {
          ...bedData,
          maintenance_reason: latestLog?.change_reason || null,
          maintenance_reported_at: latestLog?.changed_at || bedData.updated_at,
          maintenance_reported_by: latestLog?.changed_by || null,
        };
      });

      return {
        cleaning: mappedBeds.filter(b => b.bed_status === 'cleaning'),
        maintenance: mappedBeds.filter(b => b.bed_status === 'maintenance'),
      };
    } catch (error) {
      console.error('Get beds requiring attention failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get beds requiring attention.', 500);
    }
  }

  // bed history
  async getBedStatusHistory(bedId, limit = 50) {
    try {
      const history = await BedStatusLog.getBedHistory(bedId, limit);
      return history;
    } catch (error) {
      console.error('Get bed status history failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get bed status history.', 500);
    }
  }

  // get recent changes
  async getRecentStatusChanges(hours = 24) {
    try {
      const changes = await BedStatusLog.getRecentChanges(hours);
      return changes;
    } catch (error) {
      console.error('Get recent status changes failed:', error.message);
      throw error instanceof AppError
        ? error
        : new AppError('Failed to get recent status changes.', 500);
    }
  }
}

export default new BedService();
