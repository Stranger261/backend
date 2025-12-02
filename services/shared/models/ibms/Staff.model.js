import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Staff extends Model {
  static async findByUuid(staffUuid) {
    return await this.findOne({ where: { staff_uuid: staffUuid } });
  }

  static async findByEmployeeNumber(employeeNumber) {
    return await this.findOne({ where: { employee_number: employeeNumber } });
  }

  isActive() {
    return this.employment_status === 'active';
  }

  isDoctor() {
    return this.role === 'doctor';
  }
}

Staff.init(
  {
    staff_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    staff_uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      allowNull: false,
    },
    person_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    employee_number: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(
        'doctor',
        'nurse',
        'receptionist',
        'admin',
        'triage_nurse',
        'pharmacist',
        'lab_tech'
      ),
      allowNull: false,
    },
    specialization: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    license_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    employment_status: {
      type: DataTypes.ENUM('active', 'on_leave', 'terminated'),
      defaultValue: 'active',
    },
    hired_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Staff',
    tableName: 'staff',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { name: 'idx_staff_uuid', fields: ['staff_uuid'] },
      { name: 'idx_employee_number', fields: ['employee_number'] },
      { name: 'idx_role', fields: ['role'] },
    ],
  }
);

export default Staff;
