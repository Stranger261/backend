import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';

class LisService extends Model {
  static async getActiveServices() {
    return await this.findAll({
      where: {
        is_active: true,
      },
      order: [
        ['department', 'ASC'],
        ['test_name', 'ASC'],
      ],
    });
  }

  static async getServicesByDepartment(department) {
    return await this.findAll({
      where: {
        department,
        is_active: true,
      },
      order: [['test_name', 'ASC']],
    });
  }

  static async getServiceByCode(testCode) {
    return await this.findOne({
      where: {
        test_code: testCode,
      },
    });
  }

  static async getStatAvailableTests() {
    return await this.findAll({
      where: {
        is_stat_available: true,
        is_active: true,
      },
      order: [['test_name', 'ASC']],
    });
  }

  static async searchTests(searchTerm) {
    return await this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { test_code: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
          { test_name: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
        ],
        is_active: true,
      },
      limit: 20,
    });
  }
}

LisService.init(
  {
    service_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    test_code: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    test_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    department: {
      type: DataTypes.ENUM(
        'Chemistry',
        'Hematology',
        'Microbiology',
        'Immunology',
        'Molecular',
        'Blood Bank',
        'Pathology',
        'Urinalysis',
      ),
      allowNull: false,
    },
    test_category: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    specimen_type: {
      type: DataTypes.ENUM(
        'Blood',
        'Urine',
        'Stool',
        'Sputum',
        'CSF',
        'Tissue',
        'Swab',
        'Other',
      ),
      allowNull: false,
    },
    specimen_volume: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    container_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'e.g., Red top, Lavender top, Yellow top',
    },
    turnaround_time_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    requires_fasting: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_stat_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'LisService',
    tableName: 'lis_services',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_lis_service_code', fields: ['test_code'], unique: true },
      { name: 'idx_lis_service_department', fields: ['department'] },
      { name: 'idx_lis_service_active', fields: ['is_active'] },
    ],
  },
);

export default LisService;
