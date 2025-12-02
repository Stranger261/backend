import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class IdType extends Model {}

IdType.init(
  {
    id_type_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_type_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    id_type_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    country_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    requires_expiry: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
    requires_specification: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    is_government_issued: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
    verification_priority: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 100,
    },
  },
  {
    sequelize,
    modelName: 'IdType',
    tableName: 'id_types',
    createdAt: 'created_at',
    timestamps: false,
  }
);

export default IdType;
