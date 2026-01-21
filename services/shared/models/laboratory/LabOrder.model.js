import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class LabOrder extends Model {
  static async generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastOrder = await this.findOne({
      where: {
        order_number: {
          [sequelize.Sequelize.Op.like]: `LAB-${year}${month}%`,
        },
      },
      order: [['order_id', 'DESC']],
    });

    let sequence = 1;
    if (lastOrder) {
      const lastNum = parseInt(lastOrder.order_number.split('-')[2]);
      sequence = lastNum + 1;
    }

    return `LAB-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }

  static async getPendingOrders() {
    return await this.findAll({
      where: {
        order_status: ['pending', 'collected', 'processing'],
      },
      include: [
        { association: 'patient' },
        { association: 'orderedBy' },
        { association: 'tests' },
      ],
      order: [
        ['priority', 'DESC'],
        ['order_date', 'ASC'],
      ],
    });
  }
}

LabOrder.init(
  {
    order_id: {
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
    order_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    order_status: {
      type: DataTypes.ENUM(
        'pending',
        'collected',
        'processing',
        'completed',
        'cancelled'
      ),
      defaultValue: 'pending',
    },
    priority: {
      type: DataTypes.ENUM('routine', 'urgent', 'stat'),
      defaultValue: 'routine',
    },
    clinical_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Clinical indication for tests',
    },
  },
  {
    sequelize,
    modelName: 'LabOrder',
    tableName: 'lab_orders',
    timestamps: false,
    indexes: [
      { name: 'idx_lab_order_number', fields: ['order_number'] },
      { name: 'idx_lab_order_patient', fields: ['patient_id'] },
      { name: 'idx_lab_order_status', fields: ['order_status'] },
    ],
    hooks: {
      beforeCreate: async order => {
        if (!order.order_number) {
          order.order_number = await LabOrder.generateOrderNumber();
        }
      },
    },
  }
);

export default LabOrder;
