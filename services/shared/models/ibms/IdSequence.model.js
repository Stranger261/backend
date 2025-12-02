import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class IdSequence extends Model {
  static async getNextValue(sequenceType) {
    const sequence = await this.findOne({
      where: { sequence_type: sequenceType },
    });

    if (!sequence) {
      throw new Error(`Sequence type ${sequenceType} not found`);
    }

    // Check if need to reset for new year
    const currentYear = new Date().getFullYear();
    if (sequence.reset_yearly && sequence.year < currentYear) {
      await sequence.update({
        current_value: 1,
        year: currentYear,
      });
      return this.formatId(
        sequence.prefix,
        currentYear,
        1,
        sequence.padding_length
      );
    }

    // Increment
    const nextValue = sequence.current_value + 1;
    await sequence.update({ current_value: nextValue });

    return this.formatId(
      sequence.prefix,
      sequence.year,
      nextValue,
      sequence.padding_length
    );
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
