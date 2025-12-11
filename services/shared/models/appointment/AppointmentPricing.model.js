import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../../config/db.config.js';

class AppointmentPricing extends Model {
  /**
   * Get active pricing for an appointment
   * Priority: Doctor-specific > Department-specific > Default
   */
  static async getPricing(staffId, departmentId, appointmentType) {
    try {
      const now = new Date();

      // Common where conditions for active pricing
      const baseWhere = {
        appointment_type: appointmentType,
        is_active: true,
        effective_from: { [Op.lte]: now },
        [Op.or]: [
          { effective_until: null },
          { effective_until: { [Op.gte]: now } },
        ],
      };

      // 1. Try doctor-specific pricing (staff_id matches)
      let pricing = await this.findOne({
        where: {
          ...baseWhere,
          staff_id: staffId,
        },
        order: [['effective_from', 'DESC']],
      });

      // 2. Try department-specific pricing (department_id matches, staff_id is NULL)
      if (!pricing && departmentId) {
        pricing = await this.findOne({
          where: {
            ...baseWhere,
            staff_id: null,
            department_id: departmentId,
          },
          order: [['effective_from', 'DESC']],
        });
      }

      // 3. Try default pricing (both staff_id and department_id are NULL)
      if (!pricing) {
        pricing = await this.findOne({
          where: {
            ...baseWhere,
            staff_id: null,
            department_id: null,
          },
          order: [['effective_from', 'DESC']],
        });
      }

      if (!pricing) {
        throw new Error(
          `No pricing found for appointment type: ${appointmentType}`
        );
      }

      return pricing;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate total appointment cost with extensions
   */
  static calculateCost(baseFee, extensionFeePerBlock, durationMinutes) {
    const baseMinutes = 30;
    let extendedMinutes = 0;
    let extensionCost = 0;

    if (durationMinutes > baseMinutes) {
      extendedMinutes = durationMinutes - baseMinutes;
      // Calculate number of 30-minute blocks needed (round up)
      const extensionBlocks = Math.ceil(extendedMinutes / 30);
      extensionCost = extensionBlocks * parseFloat(extensionFeePerBlock);
    }

    const totalAmount = parseFloat(baseFee) + extensionCost;

    return {
      baseFee: parseFloat(baseFee),
      extendedMinutes,
      extensionFee: extensionCost,
      totalAmount,
    };
  }

  /**
   * Check if pricing is currently active
   */
  isCurrentlyActive() {
    if (!this.is_active) return false;

    const now = new Date();
    const effectiveFrom = new Date(this.effective_from);

    if (effectiveFrom > now) return false;

    if (this.effective_until) {
      const effectiveUntil = new Date(this.effective_until);
      if (effectiveUntil < now) return false;
    }

    return true;
  }
}

AppointmentPricing.init(
  {
    pricing_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    staff_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Specific doctor pricing (NULL for department/default)',
      references: {
        model: 'staff',
        key: 'staff_id',
      },
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Department pricing (NULL for default)',
      references: {
        model: 'departments',
        key: 'department_id',
      },
    },
    appointment_type: {
      type: DataTypes.ENUM('consultation', 'followup', 'procedure', 'checkup'),
      allowNull: false,
    },
    base_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 500.0,
      comment: 'Base consultation fee for first 30 minutes',
    },
    extension_fee_per_30min: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 200.0,
      comment: 'Fee per additional 30-minute block',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    effective_from: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When this pricing becomes effective',
    },
    effective_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this pricing expires (NULL = no expiry)',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'AppointmentPricing',
    tableName: 'appointment_pricing',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_staff_id',
        fields: ['staff_id'],
      },
      {
        name: 'idx_department_id',
        fields: ['department_id'],
      },
      {
        name: 'idx_appointment_type',
        fields: ['appointment_type'],
      },
      {
        name: 'idx_is_active',
        fields: ['is_active'],
      },
      {
        name: 'idx_effective_dates',
        fields: ['effective_from', 'effective_until'],
      },
    ],
  }
);

export default AppointmentPricing;
