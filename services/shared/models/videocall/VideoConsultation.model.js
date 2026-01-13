import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class VideoConsultation extends Model {
  // Check if consultation is active
  isActive() {
    return this.status === 'in_progress' || this.status === 'waiting';
  }

  // Check if both participants have joined
  bothJoined() {
    return this.doctor_joined_at !== null && this.patient_joined_at !== null;
  }

  // Get consultation duration in seconds
  getDuration() {
    if (!this.ended_at || !this.started_at) return null;
    return Math.floor(
      (new Date(this.ended_at) - new Date(this.started_at)) / 1000
    );
  }

  // Check if consultation is scheduled for today
  isToday() {
    const today = new Date();
    const startDate = new Date(this.started_at);
    return (
      today.getFullYear() === startDate.getFullYear() &&
      today.getMonth() === startDate.getMonth() &&
      today.getDate() === startDate.getDate()
    );
  }
}

VideoConsultation.init(
  {
    consultation_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'appointments',
        key: 'appointment_id',
      },
      onDelete: 'CASCADE',
    },
    room_id: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
    },
    doctor_joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    patient_joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    connection_quality: {
      type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor'),
      allowNull: true,
    },
    had_technical_issues: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    technical_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'scheduled',
        'waiting',
        'in_progress',
        'completed',
        'cancelled'
      ),
      defaultValue: 'scheduled',
    },
    is_recorded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    recording_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'VideoConsultation',
    tableName: 'video_consultations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_appointment',
        fields: ['appointment_id'],
      },
      {
        name: 'idx_room',
        fields: ['room_id'],
      },
      {
        name: 'idx_status',
        fields: ['status'],
      },
    ],
  }
);

export default VideoConsultation;
