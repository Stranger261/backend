import sequelize from '../../config/db.config.js';

// Import model definitions
import defineRegion from './Region.model.js';
import defineProvince from './Province.model.js';
import defineCity from './City.model.js';
import defineBarangay from './Barangay.model.js';

// Initialize all models
const Region = defineRegion(sequelize);
const Province = defineProvince(sequelize);
const City = defineCity(sequelize);
const Barangay = defineBarangay(sequelize);

// Define associations
Province.belongsTo(Region, { foreignKey: 'region_code' });
Region.hasMany(Province, { foreignKey: 'region_code' });

City.belongsTo(Province, { foreignKey: 'province_code' });
Province.hasMany(City, { foreignKey: 'province_code' });

Barangay.belongsTo(City, { foreignKey: 'city_code' });
City.hasMany(Barangay, { foreignKey: 'city_code' });

export { Region, Province, City, Barangay };
