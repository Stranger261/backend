import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PrivacyPreference extends Model {}

PrivacyPreference.init(
  {
    preference_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
    },
    share_data_for_research: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    allow_marketing_emails: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    allow_sms_reminders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    allow_email_reminders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    require_2fa: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    session_timeout_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PrivacyPreference',
    tableName: 'privacy_preferences',
    timestamps: false,
  }
);

export default PrivacyPreference;
