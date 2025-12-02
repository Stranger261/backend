import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PasswordResetToken extends Model {
  isExpired() {
    return new Date() > this.expires_at;
  }

  static async createToken(userId, ipAddress) {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    return await this.create({
      user_id: userId,
      token,
      expires_at: expiresAt,
      ip_address: ipAddress,
    });
  }
}

PasswordResetToken.init(
  {
    token_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PasswordResetToken',
    tableName: 'password_reset_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ name: 'idx_token', fields: ['token'] }],
  }
);

export default PasswordResetToken;
