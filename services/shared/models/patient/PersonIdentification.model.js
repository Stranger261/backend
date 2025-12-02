import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PersonIdentification extends Model {}

PersonIdentification.init(
  {
    identification_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    person_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    id_specification: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ocr_data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ocr_confidence_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    ocr_extracted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    verification_status: {
      type: DataTypes.ENUM('verified', 'rejected', 'expired'),
      allowNull: false,
      defaultValue: 'verified',
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    front_image_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PersonIdentification',
    tableName: 'person_identification',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
    indexes: [{ name: 'idx_person_id', fields: ['person_id'] }],
  }
);

export default PersonIdentification;
