import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Prescription extends Model {
  static async generatePrescriptionNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastPrescription = await this.findOne({
      where: {
        prescription_number: {
          [sequelize.Sequelize.Op.like]: `RX-${year}${month}%`,
        },
      },
      order: [['prescription_id', 'DESC']],
    });

    let sequence = 1;
    if (lastPrescription) {
      const lastNum = parseInt(
        lastPrescription.prescription_number.split('-')[2]
      );
      sequence = lastNum + 1;
    }

    return `RX-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }

  static async getActiveByPatient(patientId) {
    return await this.findAll({
      where: {
        patient_id: patientId,
        prescription_status: 'active',
      },
      include: [{ association: 'items' }, { association: 'prescribedBy' }],
      order: [['prescription_date', 'DESC']],
    });
  }
}

Prescription.init(
  {
    prescription_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    prescription_number: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'appointments',
        key: 'appointment_id',
      },
    },
    admission_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admissions',
        key: 'admission_id',
      },
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'patient',
        key: 'patient_id',
      },
    },
    prescribed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Doctor staff_id',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    prescription_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    prescription_status: {
      type: DataTypes.ENUM('active', 'completed', 'cancelled'),
      defaultValue: 'active',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Prescription',
    tableName: 'prescriptions',
    timestamps: false,
    indexes: [
      { name: 'idx_prescription_number', fields: ['prescription_number'] },
      { name: 'idx_prescription_patient', fields: ['patient_id'] },
      { name: 'idx_prescription_appointment', fields: ['appointment_id'] },
    ],
    hooks: {
      beforeCreate: async prescription => {
        if (!prescription.prescription_number) {
          prescription.prescription_number =
            await Prescription.generatePrescriptionNumber();
        }
      },
    },
  }
);

export default Prescription;
