// models/BedAssignment.js
import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';
import Bed from './Bed.model.js';
import Room from './Room.model.js';

class BedAssignment extends Model {
  static async assignBed(admissionId, bedId, assignedBy, transaction = null) {
    // Release current bed if any
    await this.update(
      {
        is_current: false,
        released_at: new Date(),
      },
      {
        where: {
          admission_id: admissionId,
          is_current: true,
        },
        transaction,
      },
    );

    // Update old bed status to available
    const currentAssignment = await this.findOne({
      where: { admission_id: admissionId, is_current: true },
      transaction,
    });

    if (currentAssignment) {
      await Bed.update(
        { bed_status: 'available' },
        { where: { bed_id: currentAssignment.bed_id }, transaction },
      );
    }

    // Update new bed status to occupied
    await Bed.update(
      { bed_status: 'occupied' },
      { where: { bed_id: bedId }, transaction },
    );

    // Assign new bed
    return await this.create(
      {
        admission_id: admissionId,
        bed_id: bedId,
        assigned_by: assignedBy,
        is_current: true,
      },
      { transaction },
    );
  }

  static async getCurrentBed(admissionId) {
    return await this.findOne({
      where: {
        admission_id: admissionId,
        is_current: true,
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
    });
  }

  static async getBedHistory(admissionId) {
    return await this.findAll({
      where: { admission_id: admissionId },
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
  }

  static async releaseBed(admissionId, transaction = null) {
    const assignment = await this.findOne({
      where: { admission_id: admissionId, is_current: true },
      transaction,
    });

    if (assignment) {
      // Update assignment
      assignment.is_current = false;
      assignment.released_at = new Date();
      await assignment.save({ transaction });

      // Update bed status
      await Bed.update(
        { bed_status: 'cleaning' },
        { where: { bed_id: assignment.bed_id }, transaction },
      );

      return assignment;
    }

    return null;
  }
}

BedAssignment.init(
  {
    assignment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bed_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    released_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transfer_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'BedAssignment',
    tableName: 'bed_assignments',
    timestamps: false,
    indexes: [
      {
        name: 'idx_admission_current',
        fields: ['admission_id', 'is_current'],
      },
    ],
  },
);

export default BedAssignment;
