import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';
import IdSequence from '../../ibms/IdSequence.model.js';

class LisTestOrder extends Model {
  static async generateOrderNumber() {
    return await IdSequence.getNextValue('lis_order');
  }

  static async getPendingOrders() {
    return await this.findAll({
      where: {
        order_status: ['Ordered', 'Collected', 'Received', 'In Progress'],
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [
        ['priority', 'DESC'],
        ['order_date', 'ASC'],
      ],
    });
  }

  static async getOrdersByPatient(patientId, limit = 10) {
    return await this.findAll({
      where: { patient_id: patientId },
      include: [
        { association: 'service' },
        { association: 'specimens' },
        { association: 'results' },
      ],
      order: [
        ['order_date', 'DESC'],
        ['order_time', 'DESC'],
      ],
      limit,
    });
  }

  static async getStatOrders() {
    return await this.findAll({
      where: {
        priority: 'STAT',
        order_status: ['Ordered', 'Collected', 'Received', 'In Progress'],
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [
        ['order_date', 'ASC'],
        ['order_time', 'ASC'],
      ],
    });
  }

  static async getOrdersByPhysician(physician, startDate, endDate) {
    return await this.findAll({
      where: {
        ordering_physician: physician,
        order_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [{ association: 'patient' }, { association: 'service' }],
      order: [['order_date', 'DESC']],
    });
  }

  async markAsCollected() {
    this.order_status = 'Collected';
    await this.save();
  }

  async markAsReceived() {
    this.order_status = 'Received';
    await this.save();
  }

  async markAsInProgress() {
    this.order_status = 'In Progress';
    await this.save();
  }

  async markAsCompleted() {
    this.order_status = 'Completed';
    await this.save();
  }

  async cancel() {
    this.order_status = 'Cancelled';
    await this.save();
  }
}

LisTestOrder.init(
  {
    order_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_patients',
        key: 'patient_id',
      },
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_services',
        key: 'service_id',
      },
    },
    ordering_physician: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    order_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    order_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM('Routine', 'Urgent', 'STAT'),
      defaultValue: 'Routine',
    },
    clinical_indication: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order_status: {
      type: DataTypes.ENUM(
        'Ordered',
        'Collected',
        'Received',
        'In Progress',
        'Completed',
        'Cancelled',
      ),
      defaultValue: 'Ordered',
    },
    created_by: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'LisTestOrder',
    tableName: 'lis_test_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_lis_order_number', fields: ['order_number'], unique: true },
      { name: 'idx_lis_order_patient', fields: ['patient_id'] },
      { name: 'idx_lis_order_date', fields: ['order_date'] },
      { name: 'idx_lis_order_status', fields: ['order_status'] },
      { name: 'idx_lis_order_priority', fields: ['priority'] },
    ],
    hooks: {
      beforeCreate: async order => {
        if (!order.order_number) {
          order.order_number = await LisTestOrder.generateOrderNumber();
        }
      },
    },
  },
);

export default LisTestOrder;
