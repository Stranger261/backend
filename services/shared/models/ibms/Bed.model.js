// models/Bed.js
import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';
import Room from './Room.model.js';

class Bed extends Model {
  static async getBedsWithRoomInfo(filters = {}) {
    const { floor, roomType, bedType, status } = filters;

    const where = {};
    if (bedType) where.bed_type = bedType;
    if (status) where.bed_status = status;

    return await this.findAll({
      where,
      include: [
        {
          model: Room,
          as: 'room',
          where: {
            ...(floor && { floor_number: floor }),
            ...(roomType && { room_type: roomType }),
          },
          required: true,
        },
      ],
      order: [
        [{ model: Room, as: 'room' }, 'floor_number', 'ASC'],
        [{ model: Room, as: 'room' }, 'room_number', 'ASC'],
        ['bed_number', 'ASC'],
      ],
    });
  }

  static async getFloorSummary() {
    // Get all operational rooms with their beds
    const rooms = await Room.findAll({
      where: { is_operational: true },
      include: [
        {
          model: this,
          as: 'beds',
          attributes: ['bed_id', 'bed_status'],
        },
      ],
      attributes: ['floor_number'],
    });

    // Group by floor and calculate statistics
    const floorStats = {};

    rooms.forEach(room => {
      const floor = room.floor_number;

      if (!floorStats[floor]) {
        floorStats[floor] = {
          floor_number: floor,
          total_beds: 0,
          available_beds: 0,
          occupied_beds: 0,
        };
      }

      room.beds.forEach(bed => {
        floorStats[floor].total_beds++;
        if (bed.bed_status === 'available') {
          floorStats[floor].available_beds++;
        } else if (bed.bed_status === 'occupied') {
          floorStats[floor].occupied_beds++;
        }
      });
    });

    // Convert to array and sort by floor number
    return Object.values(floorStats).sort(
      (a, b) => a.floor_number - b.floor_number,
    );
  }

  static async getRoomsSummary(floorNumber) {
    const rooms = await Room.findAll({
      where: {
        floor_number: floorNumber,
        is_operational: true,
      },
      include: [
        {
          model: this,
          as: 'beds',
          attributes: ['bed_id', 'bed_status'],
        },
      ],
      attributes: ['room_id', 'room_number', 'room_type', 'max_capacity'],
      order: [['room_number', 'ASC']],
    });

    // Calculate bed statistics for each room
    return rooms.map(room => {
      const total_beds = room.beds.length;
      const available_beds = room.beds.filter(
        bed => bed.bed_status === 'available',
      ).length;

      return {
        room_id: room.room_id,
        room_number: room.room_number,
        room_type: room.room_type,
        max_capacity: room.max_capacity,
        total_beds,
        available_beds,
      };
    });
  }

  static async getAvailableBeds(bedType = null) {
    const where = { bed_status: 'available' };
    if (bedType) where.bed_type = bedType;

    return await this.findAll({ where });
  }

  isAvailable() {
    return this.bed_status === 'available';
  }

  getFeatures() {
    return typeof this.features === 'string'
      ? JSON.parse(this.features)
      : this.features;
  }
}

Bed.init(
  {
    bed_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    room_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bed_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    bed_type: {
      type: DataTypes.ENUM(
        'icu',
        'private',
        'semi_private',
        'ward',
        'isolation',
      ),
      allowNull: false,
    },
    bed_status: {
      type: DataTypes.ENUM(
        'available',
        'occupied',
        'maintenance',
        'reserved',
        'cleaning',
      ),
      defaultValue: 'available',
    },
    features: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    last_cleaned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    maintenance_reported_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Bed',
    tableName: 'beds',
    timestamps: false,
    indexes: [{ name: 'idx_bed_status', fields: ['bed_status'] }],
  },
);

export default Bed;
