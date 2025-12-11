import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class IdSequence extends Model {
  static async getNextValue(sequenceType) {
    const transaction = await sequelize.transaction();

    try {
      const currentYear = new Date().getFullYear();

      // Define defaults for each sequence type
      const sequenceDefaults = {
        mrn: { prefix: 'MRN', padding_length: 6 },
        appointment: { prefix: 'APT', padding_length: 6 },
        admission: { prefix: 'ADM', padding_length: 6 },
        er_visit: { prefix: 'ER', padding_length: 6 },
        invoice: { prefix: 'INV', padding_length: 6 },
        prescription: { prefix: 'RX', padding_length: 6 },
        lab_order: { prefix: 'LAB', padding_length: 6 },
      };

      const defaults = sequenceDefaults[sequenceType];

      if (!defaults) {
        throw new Error(`Invalid sequence type: ${sequenceType}`);
      }

      // Find or create the sequence
      const [sequence, created] = await IdSequence.findOrCreate({
        where: { sequence_type: sequenceType },
        defaults: {
          sequence_type: sequenceType,
          prefix: defaults.prefix,
          current_value: 0,
          year: currentYear,
          reset_yearly: true,
          padding_length: defaults.padding_length,
          last_updated: new Date(),
        },
        transaction,
      });

      // Check if need to reset for new year
      if (sequence.reset_yearly && sequence.year < currentYear) {
        sequence.current_value = 1;
        sequence.year = currentYear;
        sequence.last_updated = new Date();
        await sequence.save({ transaction });

        await transaction.commit();

        return this.formatId(
          sequence.prefix,
          currentYear,
          1,
          sequence.padding_length
        );
      }

      // Increment
      sequence.current_value += 1;
      sequence.last_updated = new Date();
      await sequence.save({ transaction });

      await transaction.commit();

      return this.formatId(
        sequence.prefix,
        sequence.year,
        sequence.current_value,
        sequence.padding_length
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static formatId(prefix, year, value, padding) {
    const paddedValue = String(value).padStart(padding, '0');
    return `${prefix}-${year}-${paddedValue}`;
  }
}

IdSequence.init(
  {
    sequence_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sequence_type: {
      type: DataTypes.ENUM(
        'mrn',
        'appointment',
        'admission',
        'er_visit',
        'invoice',
        'prescription',
        'lab_order'
      ),
      unique: true,
      allowNull: false,
    },
    prefix: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    current_value: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reset_yearly: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    padding_length: {
      type: DataTypes.INTEGER,
      defaultValue: 6,
    },
    last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'IdSequence',
    tableName: 'id_sequences',
    timestamps: false,
  }
);

export default IdSequence;
