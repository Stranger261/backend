import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class LabOrderTest extends Model {
  isAbnormal() {
    return (
      this.result_status === 'abnormal' || this.result_status === 'critical'
    );
  }

  isCritical() {
    return this.result_status === 'critical';
  }
}

LabOrderTest.init(
  {
    test_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lab_orders',
        key: 'order_id',
      },
    },
    test_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    test_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    specimen_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'e.g., blood, urine, stool',
    },
    // Results
    result_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    result_unit: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    reference_range: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    result_status: {
      type: DataTypes.ENUM('normal', 'abnormal', 'critical'),
      allowNull: true,
    },
    // Performers
    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Lab tech staff_id',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    performed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verified_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Doctor staff_id who verified results',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'LabOrderTest',
    tableName: 'lab_order_tests',
    timestamps: false,
    indexes: [
      { name: 'idx_lab_test_order', fields: ['order_id'] },
      { name: 'idx_lab_test_status', fields: ['result_status'] },
    ],
  }
);

export default LabOrderTest;
