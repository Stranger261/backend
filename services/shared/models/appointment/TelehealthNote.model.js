import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class TelehealthNote extends Model {}

TelehealthNote.init(
  {
    note_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    consultation_notes: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    prescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lab_orders: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    follow_up_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    follow_up_days: {
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
    modelName: 'TelehealthNote',
    tableName: 'telehealth_notes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

export default TelehealthNote;
