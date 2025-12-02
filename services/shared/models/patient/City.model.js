import { DataTypes } from 'sequelize';
import sequelize, { Model } from '../../config/db.config.js';

class City extends Model {}

City.init(
  {
    city_code: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    province_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    city_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    city_type: {
      type: DataTypes.ENUM('city', 'municipality'),
      allowNull: false,
    },
    display_order: {
      type: DataTypes.SMALLINT,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'City',
    tableName: 'ph_cities',
    timestamps: false,
    indexes: [
      { fields: ['province_code', 'is_active', 'display_order'] },
      { fields: ['deleted_at'] },
    ],
  }
);
export default City;
