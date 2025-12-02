import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class DoctorLeave extends Model {
  static async isDoctorOnLeave(doctorId, date) {
    const leave = await this.findOne({
      where: {
        doctor_id: doctorId,
        start_date: { [sequelize.Op.lte]: date },
        end_date: { [sequelize.Op.gte]: date },
        status: 'approved',
      },
    });
    return !!leave;
  }
}

DoctorLeave.init(
  {
    leave_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    leave_type: {
      type: DataTypes.ENUM(
        'vacation',
        'sick',
        'conference',
        'emergency',
        'other'
      ),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
      defaultValue: 'pending',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'DoctorLeave',
    tableName: 'doctor_leaves',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

export default DoctorLeave;
