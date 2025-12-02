import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class DoctorSchedule extends Model {
  static async getDoctorSchedule(doctorId, dayOfWeek) {
    return await this.findAll({
      where: {
        doctor_id: doctorId,
        day_of_week: dayOfWeek,
        is_active: true,
      },
    });
  }

  isAvailable(time) {
    return time >= this.start_time && time <= this.end_time;
  }
}

DoctorSchedule.init(
  {
    schedule_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    day_of_week: {
      type: DataTypes.ENUM(
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
      ),
      allowNull: false,
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    slot_duration: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
    },
    max_patients: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    effective_until: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'DoctorSchedule',
    tableName: 'doctor_schedules',
    timestamps: false,
    indexes: [{ name: 'idx_doctor_day', fields: ['doctor_id', 'day_of_week'] }],
  }
);

export default DoctorSchedule;
