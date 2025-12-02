import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Department extends Model {
  static async findByCode(departmentCode) {
    return await this.findOne({ where: { department_code: departmentCode } });
  }
}

Department.init(
  {
    department_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    department_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    department_code: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    head_of_department: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Department',
    tableName: 'departments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ name: 'idx_code', fields: ['department_code'] }],
  }
);

export default Department;
