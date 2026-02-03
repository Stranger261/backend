import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';

class RisService extends Model {
  static async getActiveServices() {
    return await this.findAll({
      where: {
        is_active: true,
      },
      order: [
        ['service_category', 'ASC'],
        ['service_name', 'ASC'],
      ],
    });
  }

  static async getServicesByCategory(category) {
    return await this.findAll({
      where: {
        service_category: category,
        is_active: true,
      },
      order: [['service_name', 'ASC']],
    });
  }

  static async getServiceByCode(serviceCode) {
    return await this.findOne({
      where: {
        service_code: serviceCode,
      },
    });
  }
}

RisService.init(
  {
    service_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    service_code: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    service_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    service_category: {
      type: DataTypes.ENUM(
        'X-Ray',
        'CT',
        'MRI',
        'Ultrasound',
        'Mammography',
        'Fluoroscopy',
        'Nuclear Medicine',
        'Interventional',
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    requires_contrast: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    requires_sedation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'RisService',
    tableName: 'ris_services',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_ris_service_code', fields: ['service_code'] },
      { name: 'idx_ris_service_category', fields: ['service_category'] },
      { name: 'idx_ris_service_active', fields: ['is_active'] },
    ],
  },
);

export default RisService;
