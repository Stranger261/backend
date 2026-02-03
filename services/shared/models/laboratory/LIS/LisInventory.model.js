import { DataTypes, Model } from 'sequelize';
import sequelize from '../../../config/db.config.js';

class LisInventory extends Model {
  static async getLowStockItems() {
    return await this.findAll({
      where: {
        status: 'Low Stock',
      },
      order: [['item_name', 'ASC']],
    });
  }

  static async getExpiredItems() {
    return await this.findAll({
      where: {
        status: 'Expired',
      },
      order: [['expiration_date', 'DESC']],
    });
  }

  static async getExpiringItems(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await this.findAll({
      where: {
        expiration_date: {
          [sequelize.Sequelize.Op.between]: [
            new Date().toISOString().split('T')[0],
            futureDate.toISOString().split('T')[0],
          ],
        },
        status: 'Available',
      },
      order: [['expiration_date', 'ASC']],
    });
  }

  static async getItemsByCategory(category) {
    return await this.findAll({
      where: { category },
      order: [['item_name', 'ASC']],
    });
  }

  static async searchItems(searchTerm) {
    return await this.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { item_code: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
          { item_name: { [sequelize.Sequelize.Op.like]: `%${searchTerm}%` } },
        ],
      },
      limit: 20,
    });
  }

  async updateQuantity(quantity) {
    this.quantity = quantity;
    await this.checkStatus();
    await this.save();
  }

  async addStock(quantity) {
    this.quantity += quantity;
    await this.checkStatus();
    await this.save();
  }

  async removeStock(quantity) {
    if (this.quantity >= quantity) {
      this.quantity -= quantity;
      await this.checkStatus();
      await this.save();
      return true;
    }
    return false;
  }

  async checkStatus() {
    const today = new Date().toISOString().split('T')[0];

    if (this.expiration_date && this.expiration_date < today) {
      this.status = 'Expired';
    } else if (this.quantity <= this.minimum_quantity) {
      this.status = 'Low Stock';
    } else {
      this.status = 'Available';
    }
  }

  async markAsDiscarded() {
    this.status = 'Discarded';
    await this.save();
  }

  isLowStock() {
    return this.quantity <= this.minimum_quantity;
  }

  isExpired() {
    const today = new Date().toISOString().split('T')[0];
    return this.expiration_date && this.expiration_date < today;
  }

  isExpiringSoon(days = 30) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return (
      this.expiration_date &&
      new Date(this.expiration_date) >= today &&
      new Date(this.expiration_date) <= futureDate
    );
  }
}

LisInventory.init(
  {
    inventory_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    item_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    item_code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM(
        'Reagent',
        'Consumable',
        'Control',
        'Calibrator',
        'Equipment',
      ),
      allowNull: false,
    },
    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lot_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    expiration_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'e.g., bottles, vials, boxes, units',
    },
    minimum_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Reorder threshold',
    },
    storage_location: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Available', 'Low Stock', 'Expired', 'Discarded'),
      defaultValue: 'Available',
    },
  },
  {
    sequelize,
    modelName: 'LisInventory',
    tableName: 'lis_inventory',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'idx_lis_inventory_code', fields: ['item_code'], unique: true },
      { name: 'idx_lis_inventory_category', fields: ['category'] },
      { name: 'idx_lis_inventory_expiration', fields: ['expiration_date'] },
      { name: 'idx_lis_inventory_status', fields: ['status'] },
    ],
    hooks: {
      beforeSave: async inventory => {
        await inventory.checkStatus();
      },
    },
  },
);

export default LisInventory;
