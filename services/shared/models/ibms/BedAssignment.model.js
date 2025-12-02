import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class BedAssignment extends Model {
  static async assignBed(admissionId, bedId, assignedBy) {
    // Release current bed if any
    await this.update(
      { is_current: false, released_at: new Date() },
      { where: { admission_id: admissionId, is_current: true } }
    );

    // Assign new bed
    return await this.create({
      admission_id: admissionId,
      bed_id: bedId,
      assigned_by: assignedBy,
      is_current: true,
    });
  }

  static async getCurrentBed(admissionId) {
    return await this.findOne({
      where: { admission_id: admissionId, is_current: true },
    });
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
  }
);

export default BedAssignment;
