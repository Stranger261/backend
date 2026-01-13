import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class VideoWaitingRoom extends Model {
  // Check if user is currently waiting
  isWaiting() {
    return this.status === 'waiting';
  }

  // Check if user has been waiting too long (e.g., more than 15 minutes)
  isWaitingTooLong() {
    if (!this.checked_in_at) return false;
    const waitTime = Date.now() - new Date(this.checked_in_at).getTime();
    return waitTime > 15 * 60 * 1000; // 15 minutes in milliseconds
  }

  // Get waiting duration in minutes
  getWaitingDuration() {
    if (!this.checked_in_at) return 0;
    const duration = Date.now() - new Date(this.checked_in_at).getTime();
    return Math.floor(duration / 60000); // Convert to minutes
  }
}

VideoWaitingRoom.init(
  {
    waiting_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'appointments',
        key: 'appointment_id',
      },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_type: {
      type: DataTypes.ENUM('patient', 'doctor'),
      allowNull: false,
    },
    checked_in_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    is_ready: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    peer_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    socket_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('waiting', 'joined', 'left'),
      defaultValue: 'waiting',
    },
  },
  {
    sequelize,
    modelName: 'VideoWaitingRoom',
    tableName: 'video_waiting_room',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_appointment',
        fields: ['appointment_id'],
      },
      {
        name: 'idx_status',
        fields: ['status'],
      },
      {
        name: 'idx_user_appointment',
        fields: ['user_id', 'appointment_id', 'user_type'],
        unique: true,
      },
    ],
  }
);

export default VideoWaitingRoom;
