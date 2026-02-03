import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../../config/db.config.js';

class User extends Model {
  async validatePassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  static async findByEmail(email) {
    return await this.findOne({ where: { email } });
  }
}

User.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      validate: { isEmail: true },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    mfa_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    mfa_method: {
      type: DataTypes.ENUM('totp', 'sms', 'email', 'disabled'),
      allowNull: true,
      defaultValue: 'disabled',
    },
    registration_status: {
      type: DataTypes.ENUM(
        'email_verification',
        'personal_info_verification',
        'face_verification',
        'completed',
      ),
      defaultValue: 'email_verification',
    },
    account_status: {
      type: DataTypes.ENUM('pending', 'active', 'inactive', 'suspended'),
      defaultValue: 'pending',
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    remember_token_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    remember_token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_email', fields: ['email'] },
      { name: 'idx_user_uuid', fields: ['user_uuid'] },
      { name: 'idx_registration_status', fields: ['registration_status'] },
    ],
    hooks: {
      beforeCreate: async user => {
        if (!user.user_uuid || user.user_uuid === 'UUIDV4') {
          user.user_uuid = uuidv4();
        }
      },
    },
  },
);

export default User;
