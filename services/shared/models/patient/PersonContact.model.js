import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PersonContact extends Model {
  static async getPrimaryContact(personId) {
    return await this.findOne({
      where: { person_id: personId, is_primary: true },
    });
  }
}

PersonContact.init(
  {
    contact_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    person_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    contact_type: {
      type: DataTypes.ENUM('mobile', 'home', 'work', 'emergency'),
      allowNull: false,
    },
    contact_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    contact_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    relationship: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'PersonContact',
    tableName: 'person_contacts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
    indexes: [{ name: 'idx_person_id', fields: ['person_id'] }],
  }
);

export default PersonContact;
