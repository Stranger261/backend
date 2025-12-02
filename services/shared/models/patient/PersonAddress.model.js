import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/db.config.js';

class PersonAddress extends Model {
  static async getPrimaryAddress(personId) {
    return await this.findOne({
      where: { person_id: personId, is_primary: true },
    });
  }

  async getFullAddress() {
    // Load related address data
    const { Region, Province, City, Barangay } = await import('./index.js');

    const barangay = await Barangay.findByPk(this.barangay_code);
    const city = await City.findByPk(this.city_code);
    const province = await Province.findByPk(this.province_code);
    const region = await Region.findByPk(this.region_code);

    const parts = [];

    // Building/House info
    if (this.unit_floor) parts.push(this.unit_floor);
    if (this.building_name) parts.push(this.building_name);
    if (this.house_number) parts.push(this.house_number);
    if (this.street_name) parts.push(this.street_name);
    if (this.subdivision) parts.push(this.subdivision);

    // Philippine address hierarchy
    if (barangay) parts.push(`Barangay ${barangay.barangay_name}`);
    if (city) parts.push(city.getDisplayName());
    if (province) parts.push(province.province_name);
    if (this.zip_code) parts.push(this.zip_code);

    return parts.join(', ');
  }
}

PersonAddress.init(
  {
    address_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    person_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    address_type: {
      type: DataTypes.ENUM('home', 'work', 'billing', 'emergency'),
      allowNull: false,
      defaultValue: 'home',
    },

    // PHILIPPINE ADDRESS HIERARCHY (Required)
    region_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'PH Region Code (e.g., "13" for NCR)',
    },
    province_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'PH Province Code',
    },
    city_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'PH City/Municipality Code',
    },
    barangay_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'PH Barangay Code',
    },

    // SPECIFIC LOCATION DETAILS (Optional but recommended)
    unit_floor: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Unit 123, 4th Floor, etc.',
    },
    building_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Building/Condo name',
    },
    house_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'House/Lot number',
    },
    street_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Street name',
    },
    subdivision: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Subdivision/Village name',
    },

    // ADDITIONAL INFO
    zip_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Postal/ZIP code',
    },
    landmark: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Near XYZ Mall, beside ABC Store',
    },
    delivery_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Special instructions for deliveries',
    },

    // COORDINATES (Optional - for mapping)
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: 'GPS latitude',
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: 'GPS longitude',
    },

    // FLAGS
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Address verified by staff or delivery',
    },

    // TIMESTAMPS
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PersonAddress',
    tableName: 'person_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
    indexes: [
      { name: 'idx_person_id', fields: ['person_id'] },
      { name: 'idx_primary', fields: ['person_id', 'is_primary'] },
      {
        name: 'idx_address_hierarchy',
        fields: ['region_code', 'province_code', 'city_code', 'barangay_code'],
      },
    ],
  }
);

export default PersonAddress;
