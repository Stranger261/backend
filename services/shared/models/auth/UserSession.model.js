import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class UserSession extends Model {
  static async revokeUserSessions(userId) {
    return await this.update(
      {
        revoked: true,
        revoked_at: new Date(),
        device_name: 'Revoked by System',
      },
      {
        where: {
          user_id: userId,
          revoked: false,
          expires_at: { [Op.gt]: new Date() },
        },
      },
    );
  }

  static async revokeSessionByTokenHash(tokenHash) {
    return await this.update(
      {
        revoked: true,
        revoked_at: new Date(),
      },
      {
        where: {
          token_hash: tokenHash,
          revoked: false,
        },
      },
    );
  }

  static async getActiveUserSessions(userId) {
    return await this.findAll({
      where: {
        user_id: userId,
        revoked: false,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [['last_activity', 'DESC']],
    });
  }

  isExpired() {
    return new Date() > this.expires_at;
  }

  isActive() {
    return !this.revoked && !this.isExpired();
  }

  toJSON() {
    const values = Object.assign({}, this.get());

    // Remove sensitive information
    delete values.token_hash;

    // Format dates
    values.last_activity = this.last_activity?.toISOString();
    values.expires_at = this.expires_at?.toISOString();
    values.created_at = this.created_at?.toISOString();

    // Add status
    values.status = this.isActive() ? 'active' : 'inactive';

    return values;
  }
}

UserSession.init(
  {
    session_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
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
      type: DataTypes.ENUM(
        'web',
        'mobile_ios',
        'mobile_android',
        'tablet',
        'desktop',
      ),
      defaultValue: 'web',
    },
    device_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Unknown Device',
    },
    location: {
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
    revoked_reason: {
      type: DataTypes.ENUM(
        'user_logout',
        'inactivity',
        'force_logout',
        'security',
        'other',
      ),
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
      { name: 'idx_revoked', fields: ['revoked'] },
    ],
  },
);

export default UserSession;
