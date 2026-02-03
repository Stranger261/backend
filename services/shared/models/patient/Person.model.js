import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';
import { v4 as uuidv4 } from 'uuid';

class Person extends Model {
  getFullName() {
    return `${this.first_name} ${this.middle_name || ''} ${
      this.last_name
    }`.trim();
  }

  static async findByUuid(personUuid) {
    return await this.findOne({ where: { person_uuid: personUuid } });
  }
}

Person.init(
  {
    person_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    middle_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    suffix: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: false,
    },
    blood_type: {
      type: DataTypes.ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING(50),
      defaultValue: 'Filipino',
    },
    civil_status: {
      type: DataTypes.ENUM(
        'single',
        'married',
        'widowed',
        'divorced',
        'separated',
      ),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      validate: { isEmail: true },
    },
    face_encoding: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    face_image_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    face_quality_score: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    face_captured_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Person',
    tableName: 'person',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
    indexes: [
      { name: 'idx_user_id', fields: ['user_id'] },
      { name: 'idx_full_name', fields: ['last_name', 'first_name'] },
    ],
  },
);

export default Person;
