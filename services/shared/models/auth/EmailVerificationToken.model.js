import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class EmailVerificationToken extends Model {
  isExpired() {
    return new Date() > this.expires_at;
  }
}

EmailVerificationToken.init(
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
    purpose: {
      type: DataTypes.ENUM('registration', 'login_2fa', 'password_reset'),
      defaultValue: 'registration',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'EmailVerificationToken',
    tableName: 'email_verification_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

export default EmailVerificationToken;
