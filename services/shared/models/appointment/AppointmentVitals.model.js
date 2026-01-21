import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AppointmentVitals extends Model {
  static async getByAppointment(appointmentId) {
    return await this.findOne({
      where: { appointment_id: appointmentId },
      include: [
        { association: 'appointment' },
        { association: 'patient' },
        { association: 'recordedBy' },
      ],
    });
  }

  calculateBMI() {
    if (this.height && this.weight) {
      const heightInMeters = this.height / 100;
      return (this.weight / (heightInMeters * heightInMeters)).toFixed(2);
    }
    return null;
  }

  getBloodPressure() {
    if (this.blood_pressure_systolic && this.blood_pressure_diastolic) {
      return `${this.blood_pressure_systolic}/${this.blood_pressure_diastolic}`;
    }
    return null;
  }
}

AppointmentVitals.init(
  {
    vital_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    appointment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'appointments',
        key: 'appointment_id',
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
    recorded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Staff ID of nurse who recorded vitals',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    recorded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    // Vital Signs
    temperature: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      comment: 'Temperature in Celsius',
    },
    blood_pressure_systolic: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    blood_pressure_diastolic: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    heart_rate: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Beats per minute',
    },
    respiratory_rate: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Breaths per minute',
    },
    oxygen_saturation: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'SpO2 percentage',
    },
    // Physical Measurements
    height: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Height in cm',
    },
    weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Weight in kg',
    },
    bmi: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      comment: 'Body Mass Index',
    },
    // Pre-consultation
    chief_complaint: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pain_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 10 },
      comment: 'Pain scale 0-10',
    },
    // Triage
    triage_level: {
      type: DataTypes.ENUM('emergency', 'urgent', 'semi_urgent', 'non_urgent'),
      defaultValue: null,
      allowNull: true,
    },
    nurse_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AppointmentVitals',
    tableName: 'appointment_vitals',
    timestamps: false,
    indexes: [
      {
        name: 'idx_appointment_vitals_appointment',
        fields: ['appointment_id'],
      },
      { name: 'idx_appointment_vitals_patient', fields: ['patient_id'] },
      { name: 'idx_appointment_vitals_recorded_by', fields: ['recorded_by'] },
    ],
    hooks: {
      beforeCreate: vitals => {
        if (vitals.height && vitals.weight) {
          vitals.bmi = vitals.calculateBMI();
        }
      },
      beforeUpdate: vitals => {
        if (vitals.height && vitals.weight) {
          vitals.bmi = vitals.calculateBMI();
        }
      },
    },
  },
);

export default AppointmentVitals;
