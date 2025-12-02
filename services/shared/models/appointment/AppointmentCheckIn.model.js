import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AppointmentCheckIn extends Model {
  static async checkInPatient(
    appointmentId,
    method,
    confidence = null,
    checkedInBy = null
  ) {
    return await this.create({
      appointment_id: appointmentId,
      check_in_method: method,
      face_match_confidence: confidence,
      checked_in_by: checkedInBy,
    });
  }
}

AppointmentCheckIn.init(
  {
    check_in_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    check_in_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    check_in_method: {
      type: DataTypes.ENUM('face_recognition', 'manual', 'kiosk', 'qr_code'),
      allowNull: false,
    },
    face_match_confidence: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    checked_in_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    check_out_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    waiting_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AppointmentCheckIn',
    tableName: 'appointment_check_in',
    timestamps: false,
  }
);

export default AppointmentCheckIn;
