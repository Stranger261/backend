import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PrescriptionItem extends Model {
  static async getUndispensedByPharmacy() {
    return await this.findAll({
      where: { dispensed: false },
      include: [
        {
          association: 'prescription',
          include: ['patient'],
        },
      ],
      order: [['prescription', 'prescription_date', 'ASC']],
    });
  }

  markAsDispensed(pharmacistId) {
    this.dispensed = true;
    this.dispensed_at = new Date();
    this.dispensed_by = pharmacistId;
    return this.save();
  }
}

PrescriptionItem.init(
  {
    item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    prescription_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'prescriptions',
        key: 'prescription_id',
      },
    },
    medication_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    dosage: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'e.g., 500mg',
    },
    frequency: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'e.g., 3 times daily, every 8 hours',
    },
    route: {
      type: DataTypes.ENUM(
        'oral',
        'IV',
        'IM',
        'subcutaneous',
        'topical',
        'inhalation'
      ),
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'e.g., 7 days, 2 weeks',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Total quantity to dispense',
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Special instructions for patient',
    },
    dispensed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    dispensed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dispensed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Pharmacist staff_id',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
  },
  {
    sequelize,
    modelName: 'PrescriptionItem',
    tableName: 'prescription_items',
    timestamps: false,
    indexes: [
      {
        name: 'idx_prescription_item_prescription',
        fields: ['prescription_id'],
      },
      { name: 'idx_prescription_item_dispensed', fields: ['dispensed'] },
    ],
  }
);

export default PrescriptionItem;
