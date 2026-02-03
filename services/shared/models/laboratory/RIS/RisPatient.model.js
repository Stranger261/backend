import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';
import IdSequence from '../../ibms/IdSequence.model.js';

class RisPatient extends Model {
  static async generateMRN() {
    return await IdSequence.getNextValue('mrn');
  }

  static async findByMRN(mrn) {
    return await this.findOne({
      where: { mrn },
    });
  }

  static async searchPatients(searchTerm) {
    return await this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { mrn: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
          { first_name: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
          { last_name: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
        ],
      },
      limit: 20,
    });
  }

  getFullName() {
    return `${this.first_name} ${this.last_name}`;
  }

  getAge() {
    const today = new Date();
    const birthDate = new Date(this.date_of_birth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }
}

RisPatient.init(
  {
    patient_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    mrn: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    gender: {
      type: DataTypes.ENUM('M', 'F', 'O'),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    emergency_contact: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    emergency_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'RisPatient',
    tableName: 'ris_patients',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_ris_patient_mrn', fields: ['mrn'], unique: true },
      { name: 'idx_ris_patient_name', fields: ['last_name', 'first_name'] },
      { name: 'idx_ris_patient_dob', fields: ['date_of_birth'] },
    ],
    hooks: {
      beforeCreate: async patient => {
        if (!patient.mrn) {
          patient.mrn = await RisPatient.generateMRN();
        }
      },
    },
  },
);

export default RisPatient;
