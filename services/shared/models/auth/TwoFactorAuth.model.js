import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class TwoFactorAuth extends Model {
  static async enableForUser(userId, method, secretKey) {
    return await this.upsert({
      user_id: userId,
      method,
      secret_key: secretKey,
      enabled: true,
      enabled_at: new Date(),
    });
  }
}

TwoFactorAuth.init(
  {
    tfa_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
    },
    method: {
      type: DataTypes.ENUM('totp', 'sms', 'email', 'disabled'),
      defaultValue: 'disabled',
    },
    secret_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    backup_codes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    enabled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'TwoFactorAuth',
    tableName: 'two_factor_auth',
    timestamps: false,
  }
);

export default TwoFactorAuth;
