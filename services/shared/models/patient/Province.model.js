import { DataTypes } from 'sequelize';
import sequelize, { Model } from '../../config/db.config.js';

class Province extends Model {}

Province.init(
  {
    province_code: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    region_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    province_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    province_type: {
      type: DataTypes.ENUM('province', 'district'),
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
    modelName: 'Province',
    tableName: 'ph_provinces',
    timestamps: false,
    indexes: [
      { fields: ['region_code', 'is_active', 'display_order'] },
      { fields: ['deleted_at'] },
    ],
  }
);

export default Province;
