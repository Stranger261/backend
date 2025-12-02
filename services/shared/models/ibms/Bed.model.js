import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Bed extends Model {
  static async getAvailableBeds(bedType = null) {
    const where = { bed_status: 'available' };
    if (bedType) where.bed_type = bedType;

    return await this.findAll({ where });
  }

  isAvailable() {
    return this.bed_status === 'available';
  }

  getFeatures() {
    return typeof this.features === 'string'
      ? JSON.parse(this.features)
      : this.features;
  }
}

Bed.init(
  {
    bed_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    room_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bed_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    bed_type: {
      type: DataTypes.ENUM(
        'icu',
        'private',
        'semi_private',
        'ward',
        'isolation'
      ),
      allowNull: false,
    },
    bed_status: {
      type: DataTypes.ENUM(
        'available',
        'occupied',
        'maintenance',
        'reserved',
        'cleaning'
      ),
      defaultValue: 'available',
    },
    features: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    last_cleaned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Bed',
    tableName: 'beds',
    timestamps: false,
    indexes: [{ name: 'idx_bed_status', fields: ['bed_status'] }],
  }
);

export default Bed;
