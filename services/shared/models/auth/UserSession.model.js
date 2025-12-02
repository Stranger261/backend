import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class UserSession extends Model {
  static async revokeUserSessions(userId) {
    return await this.update(
      { revoked: true, revoked_at: new Date() },
      { where: { user_id: userId, revoked: false } }
    );
  }

  isExpired() {
    return new Date() > this.expires_at;
  }
}

UserSession.init(
  {
    session_id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    token_hash: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    device_type: {
      type: DataTypes.ENUM('web', 'mobile_ios', 'mobile_android', 'tablet'),
      defaultValue: 'web',
    },
    device_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_activity: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'UserSession',
    tableName: 'user_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_user_id', fields: ['user_id'] },
      { name: 'idx_token_hash', fields: ['token_hash'] },
      { name: 'idx_expires_at', fields: ['expires_at'] },
    ],
  }
);

export default UserSession;
