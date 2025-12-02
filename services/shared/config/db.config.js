import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import AppError from '../utils/AppError.util.js';

dotenv.config();

const { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_DIALECT, DB_PORT } = process.env;

if (!DB_NAME || !DB_DIALECT || !DB_HOST || !DB_USER) {
  throw new AppError(
    '❌ Missing required database environment variables. Please check your .env file.',
    400
  );
}
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: DB_DIALECT || 'mysql',
  port: DB_PORT || 3306,
  logging: false,
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ MySQL connected to: ${DB_NAME}@${DB_HOST}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw new AppError('Internal server error.', 500);
  }
})();

export const Model = Sequelize.Model;
export default sequelize;
