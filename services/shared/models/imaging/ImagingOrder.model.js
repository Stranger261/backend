import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class ImagingOrder extends Model {
  static async generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastOrder = await this.findOne({
      where: {
        order_number: {
          [sequelize.Sequelize.Op.like]: `IMG-${year}${month}%`,
        },
      },
      order: [['imaging_id', 'DESC']],
    });

    let sequence = 1;
    if (lastOrder) {
      const lastNum = parseInt(lastOrder.order_number.split('-')[2]);
      sequence = lastNum + 1;
    }

    return `IMG-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }

  static async getPendingOrders() {
    return await this.findAll({
      where: {
        order_status: ['pending', 'scheduled'],
      },
      include: [{ association: 'patient' }, { association: 'orderedBy' }],
      order: [['scheduled_date', 'ASC']],
    });
  }
}

ImagingOrder.init(
  {
    imaging_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_number: {
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
    ordered_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Doctor staff_id',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    imaging_type: {
      type: DataTypes.ENUM('xray', 'ct', 'mri', 'ultrasound', 'pet', 'other'),
      allowNull: false,
    },
    body_part: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    clinical_indication: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Reason for imaging',
    },
    order_status: {
      type: DataTypes.ENUM('pending', 'scheduled', 'completed', 'cancelled'),
      defaultValue: 'pending',
    },
    scheduled_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    findings: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    radiologist_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Path to image file or DICOM',
    },
    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Technician staff_id',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    reported_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Radiologist staff_id',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
  },
  {
    sequelize,
    modelName: 'ImagingOrder',
    tableName: 'imaging_orders',
    timestamps: false,
    indexes: [
      { name: 'idx_imaging_order_number', fields: ['order_number'] },
      { name: 'idx_imaging_patient', fields: ['patient_id'] },
      { name: 'idx_imaging_status', fields: ['order_status'] },
    ],
    hooks: {
      beforeCreate: async order => {
        if (!order.order_number) {
          order.order_number = await ImagingOrder.generateOrderNumber();
        }
      },
    },
  }
);

export default ImagingOrder;
