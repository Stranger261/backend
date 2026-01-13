import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class ConsultationMessage extends Model {
  // Check if message has an attachment
  hasAttachment() {
    return this.message_type !== 'text' && this.file_url !== null;
  }

  // Check if message is a medical note
  isMedicalNote() {
    return this.message_type === 'note';
  }

  // Check if message was sent by doctor
  isFromDoctor() {
    return this.sender_type === 'doctor';
  }

  // Format sent time
  getFormattedTime() {
    return new Date(this.sent_at).toLocaleString();
  }
}

ConsultationMessage.init(
  {
    message_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    consultation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'video_consultations',
        key: 'consultation_id',
      },
      onDelete: 'CASCADE',
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sender_type: {
      type: DataTypes.ENUM('patient', 'doctor'),
      allowNull: false,
    },
    message_type: {
      type: DataTypes.ENUM('text', 'image', 'file', 'note'),
      defaultValue: 'text',
    },
    message_content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ConsultationMessage',
    tableName: 'consultation_messages',
    timestamps: false, // Using sent_at instead
    indexes: [
      {
        name: 'idx_consultation',
        fields: ['consultation_id'],
      },
      {
        name: 'idx_sent_at',
        fields: ['sent_at'],
      },
    ],
  }
);

export default ConsultationMessage;
