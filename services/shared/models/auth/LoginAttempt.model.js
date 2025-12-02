import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class LoginAttempt extends Model {
  static async getFailedAttempts(email, minutes = 15) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return await this.count({
      where: {
        email,
        success: false,
        attempted_at: { [sequelize.Op.gt]: since },
      },
    });
  }
}

LoginAttempt.init(
  {
    attempt_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    failure_reason: {
      type: DataTypes.ENUM(
        'invalid_password',
        'account_locked',
        'account_suspended',
        'email_not_found',
        '2fa_required',
        '2fa_failed'
      ),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attempted_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'LoginAttempt',
    tableName: 'login_attempts',
    timestamps: false,
    indexes: [
      { name: 'idx_email_time', fields: ['email', 'attempted_at'] },
      { name: 'idx_ip_time', fields: ['ip_address', 'attempted_at'] },
    ],
  }
);

export default LoginAttempt;
