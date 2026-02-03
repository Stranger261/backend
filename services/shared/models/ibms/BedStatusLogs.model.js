// shared/models/BedStatusLog.model.js
import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';
import Staff from './Staff.model.js';
import Bed from './Bed.model.js';
import Person from '../patient/Person.model.js';
import Room from './Room.model.js';

class BedStatusLog extends Model {
  /**
   * Get status change history for a specific bed
   */
  static async getBedHistory(bedId, limit = 50) {
    return await this.findAll({
      where: { bed_id: bedId },
      include: [
        {
          model: Staff,
          as: 'changedByStaff',
          attributes: ['staff_id'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
        {
          model: Bed,
          as: 'bed',
          attributes: ['bed_number'],
          include: [
            {
              model: Room,
              as: 'room',
              attributes: ['room_number', 'floor_number'],
            },
          ],
        },
      ],
      order: [['changed_at', 'DESC']],
      limit,
    });
  }

  /**
   * Get recent status changes across all beds
   */
  static async getRecentChanges(hours = 24, limit = 100) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return await this.findAll({
      where: {
        changed_at: {
          [sequelize.Sequelize.Op.gte]: since,
        },
      },
      include: [
        {
          model: Bed,
          as: 'bed',
          attributes: ['bed_number'],
          include: [
            {
              model: Room,
              as: 'room',
              attributes: ['room_number', 'floor_number'],
            },
          ],
        },
        {
          model: Staff,
          as: 'changedByStaff',
          attributes: ['staff_id'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
      ],
      order: [['changed_at', 'DESC']],
      limit,
    });
  }

  /**
   * Get audit trail for a specific admission
   */
  static async getAdmissionBedHistory(admissionId) {
    return await this.findAll({
      where: { admission_id: admissionId },
      include: [
        {
          model: sequelize.models.Bed,
          as: 'bed',
          attributes: ['bed_number'],
          include: [
            {
              model: sequelize.models.Room,
              as: 'room',
              attributes: ['room_number', 'floor_number'],
            },
          ],
        },
        {
          model: sequelize.models.Staff,
          as: 'changedByStaff',
          include: [
            {
              model: sequelize.models.Person,
              as: 'person',
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
      ],
      order: [['changed_at', 'ASC']],
    });
  }

  /**
   * Get staff activity report
   */
  static async getStaffActivityReport(staffId, startDate, endDate) {
    return await this.findAll({
      where: {
        changed_by: staffId,
        changed_at: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: sequelize.models.Bed,
          as: 'bed',
          attributes: ['bed_number'],
          include: [
            {
              model: sequelize.models.Room,
              as: 'room',
              attributes: ['room_number', 'floor_number'],
            },
          ],
        },
      ],
      order: [['changed_at', 'DESC']],
    });
  }

  /**
   * Log a bed status change
   */
  static async logStatusChange(logData, options = {}) {
    return await this.create(
      {
        bed_id: logData.bedId,
        old_status: logData.oldStatus || null,
        new_status: logData.newStatus,
        changed_by: logData.changedBy,
        change_reason: logData.reason || null,
        admission_id: logData.admissionId || null,
        assignment_id: logData.assignmentId || null,
        additional_notes: logData.notes || null,
      },
      options,
    );
  }

  /**
   * Get beds that have been in maintenance for too long
   */
  static async getLongMaintenanceBeds(hoursThreshold = 48) {
    const thresholdDate = new Date(
      Date.now() - hoursThreshold * 60 * 60 * 1000,
    );

    // Get latest status change for each bed to maintenance
    const maintenanceLogs = await sequelize.query(
      `
      SELECT bsl.*, b.bed_number, r.room_number, r.floor_number
      FROM bed_status_logs bsl
      INNER JOIN beds b ON bsl.bed_id = b.bed_id
      INNER JOIN rooms r ON b.room_id = r.room_id
      WHERE bsl.new_status = 'maintenance'
        AND bsl.changed_at < :thresholdDate
        AND b.bed_status = 'maintenance'
        AND bsl.log_id IN (
          SELECT MAX(log_id)
          FROM bed_status_logs
          WHERE new_status = 'maintenance'
          GROUP BY bed_id
        )
      ORDER BY bsl.changed_at ASC
      `,
      {
        replacements: { thresholdDate },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    return maintenanceLogs;
  }
}

BedStatusLog.init(
  {
    log_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    bed_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    old_status: {
      type: DataTypes.ENUM(
        'available',
        'occupied',
        'maintenance',
        'reserved',
        'cleaning',
      ),
      allowNull: true,
      comment: 'Previous status, null for first log entry',
    },
    new_status: {
      type: DataTypes.ENUM(
        'available',
        'occupied',
        'maintenance',
        'reserved',
        'cleaning',
      ),
      allowNull: false,
    },
    changed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Staff ID who made the change',
    },
    change_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for status change',
    },
    admission_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Related admission if applicable',
    },
    assignment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Related bed assignment if applicable',
    },
    changed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    additional_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Any additional notes or details',
    },
  },
  {
    sequelize,
    modelName: 'BedStatusLog',
    tableName: 'bed_status_logs',
    timestamps: false,
    indexes: [
      { name: 'idx_bed_id', fields: ['bed_id'] },
      { name: 'idx_changed_by', fields: ['changed_by'] },
      { name: 'idx_changed_at', fields: ['changed_at'] },
      { name: 'idx_admission_id', fields: ['admission_id'] },
      { name: 'idx_new_status', fields: ['new_status'] },
      { name: 'idx_bed_status_timeline', fields: ['bed_id', 'changed_at'] },
      { name: 'idx_staff_actions', fields: ['changed_by', 'changed_at'] },
    ],
  },
);

export default BedStatusLog;
