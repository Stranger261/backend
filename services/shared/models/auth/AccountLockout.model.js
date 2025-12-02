import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AccountLockout extends Model {
  static async lockAccount(userId, email, ipAddress, failedAttempts) {
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    return await this.create({
      user_id: userId,
      email,
      ip_address: ipAddress,
      failed_attempts: failedAttempts,
      locked_until: lockedUntil,
      lock_reason: 'failed_login',
      locked_at: new Date(),
    });
  }

  isStillLocked() {
    return this.locked_until && new Date() < this.locked_until;
  }
}

AccountLockout.init(
  {
    lockout_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    failed_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lock_reason: {
      type: DataTypes.ENUM(
        'failed_login',
        'suspicious_activity',
        'admin_action'
      ),
      allowNull: false,
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    unlocked_at: {
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
    modelName: 'AccountLockout',
    tableName: 'account_lockouts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ name: 'idx_email', fields: ['email'] }],
  }
);

export default AccountLockout;
