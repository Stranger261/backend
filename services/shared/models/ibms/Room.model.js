import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class Room extends Model {
  static async getAvailableRooms(roomType) {
    return await this.findAll({
      where: {
        room_type: roomType,
        is_operational: true,
      },
    });
  }

  getCurrentOccupancy() {
    // This would need to join with Bed table
    return 0; // Placeholder
  }
}

Room.init(
  {
    room_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    room_number: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
    room_type: {
      type: DataTypes.ENUM(
        'icu',
        'private',
        'semi_private',
        'ward',
        'isolation'
      ),
      allowNull: false,
    },
    floor_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    max_capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_operational: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Room',
    tableName: 'rooms',
    timestamps: false,
    indexes: [{ name: 'idx_room_type', fields: ['room_type'] }],
  }
);

export default Room;
