import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class TelehealthSession extends Model {
  static async createSession(appointmentId, platform, meetingUrl) {
    return await this.create({
      appointment_id: appointmentId,
      meeting_platform: platform,
      meeting_url: meetingUrl,
      session_status: 'scheduled',
    });
  }

  getDurationMinutes() {
    if (this.started_at && this.ended_at) {
      return Math.floor((this.ended_at - this.started_at) / 1000 / 60);
    }
    return null;
  }
}

TelehealthSession.init(
  {
    session_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    meeting_platform: {
      type: DataTypes.ENUM('zoom', 'google_meet', 'microsoft_teams', 'custom'),
      allowNull: false,
    },
    meeting_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    meeting_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    meeting_password: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    session_status: {
      type: DataTypes.ENUM(
        'scheduled',
        'waiting_room',
        'ongoing',
        'completed',
        'cancelled',
        'failed'
      ),
      defaultValue: 'scheduled',
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    recording_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'TelehealthSession',
    tableName: 'telehealth_sessions',
    timestamps: false,
  }
);

export default TelehealthSession;
