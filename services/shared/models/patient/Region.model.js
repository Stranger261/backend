import { DataTypes } from 'sequelize';
import sequelize, { Model } from '../../config/db.config.js';

class Region extends Model {}

Region.init(
  {
    region_code: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    region_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    region_type: {
      type: DataTypes.ENUM('region', 'ncr', 'car', 'barmm'),
      allowNull: false,
    },
    display_order: {
      type: DataTypes.TINYINT,
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
    modelName: 'Region',
    tableName: 'ph_regions',
    timestamps: false,
    indexes: [
      { fields: ['is_active', 'display_order'] },
      { fields: ['deleted_at'] },
    ],
  }
);

export default Region;
