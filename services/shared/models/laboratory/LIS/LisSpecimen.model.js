import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';
import IdSequence from '../../ibms/IdSequence.model.js';

class LisSpecimen extends Model {
  static async generateSpecimenNumber() {
    return await IdSequence.getNextValue('lis_specimen');
  }

  static async getSpecimensInTransit() {
    return await this.findAll({
      where: {
        status: 'In Transit',
      },
      include: [{ association: 'patient' }, { association: 'order' }],
      order: [
        ['collection_date', 'ASC'],
        ['collection_time', 'ASC'],
      ],
    });
  }

  static async getSpecimensAwaitingProcessing() {
    return await this.findAll({
      where: {
        status: 'Received',
      },
      include: [
        { association: 'patient' },
        { association: 'order', include: [{ association: 'service' }] },
      ],
      order: [
        ['received_date', 'ASC'],
        ['received_time', 'ASC'],
      ],
    });
  }

  static async getRejectedSpecimens(startDate, endDate) {
    return await this.findAll({
      where: {
        specimen_condition: {
          [sequelize.Sequelize.Op.in]: [
            'Hemolyzed',
            'Lipemic',
            'Clotted',
            'Insufficient',
            'Contaminated',
          ],
        },
        collection_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      include: [{ association: 'patient' }, { association: 'order' }],
      order: [['collection_date', 'DESC']],
    });
  }

  async receive(receivedBy) {
    this.status = 'Received';
    this.received_date = new Date().toISOString().split('T')[0];
    this.received_time = new Date().toTimeString().split(' ')[0];
    this.received_by = receivedBy;
    await this.save();

    // Update order status
    const order = await sequelize.models.LisTestOrder.findByPk(this.order_id);
    if (order && order.order_status === 'Collected') {
      await order.markAsReceived();
    }
  }

  async markAsProcessing() {
    this.status = 'Processing';
    await this.save();
  }

  async store(location) {
    this.status = 'Stored';
    this.storage_location = location;
    await this.save();
  }

  async discard() {
    this.status = 'Discarded';
    await this.save();
  }

  isAcceptable() {
    return this.specimen_condition === 'Acceptable';
  }
}

LisSpecimen.init(
  {
    specimen_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    specimen_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_test_orders',
        key: 'order_id',
      },
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lis_patients',
        key: 'patient_id',
      },
    },
    specimen_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    collection_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    collection_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    collected_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    received_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    received_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    received_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    volume: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    specimen_condition: {
      type: DataTypes.ENUM(
        'Acceptable',
        'Hemolyzed',
        'Lipemic',
        'Clotted',
        'Insufficient',
        'Contaminated',
      ),
      defaultValue: 'Acceptable',
    },
    storage_location: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'Collected',
        'In Transit',
        'Received',
        'Processing',
        'Stored',
        'Discarded',
      ),
      defaultValue: 'Collected',
    },
  },
  {
    sequelize,
    modelName: 'LisSpecimen',
    tableName: 'lis_specimens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_lis_specimen_number',
        fields: ['specimen_number'],
        unique: true,
      },
      { name: 'idx_lis_specimen_order', fields: ['order_id'] },
      { name: 'idx_lis_specimen_patient', fields: ['patient_id'] },
      { name: 'idx_lis_specimen_status', fields: ['status'] },
      { name: 'idx_lis_specimen_condition', fields: ['specimen_condition'] },
    ],
    hooks: {
      beforeCreate: async specimen => {
        if (!specimen.specimen_number) {
          specimen.specimen_number = await LisSpecimen.generateSpecimenNumber();
        }
      },
    },
  },
);

export default LisSpecimen;
