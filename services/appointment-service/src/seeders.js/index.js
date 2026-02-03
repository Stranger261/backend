import sequelize from '../../../shared/config/db.config.js';
import seedBedManagement from './bedManagement.js';

const runSeeders = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Run bed management seeder
    await seedBedManagement();

    // Add other seeders here
    // await seedPatients();
    // await seedStaff();
    // etc...

    console.log('🎉 All seeders completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

runSeeders();
