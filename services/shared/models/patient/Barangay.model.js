import { DataTypes } from 'sequelize';
import sequelize, { Model } from '../../config/db.config.js';

class Barangay extends Model {}

Barangay.init(
  {
    barangay_code: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    city_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    barangay_name: {
      type: DataTypes.STRING(100),
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
    modelName: 'Barangay',
    tableName: 'ph_barangays',
    timestamps: false,
    indexes: [
      { fields: ['city_code', 'is_active', 'display_order'] },
      { fields: ['deleted_at'] },
    ],
  }
);

export default Barangay;
