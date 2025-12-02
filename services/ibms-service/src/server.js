import dotenv from 'dotenv';
import sequelize from '../../shared/config/db.config.js';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 56743;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: false });
      console.log('✅ Database synced.');
    }

    app.listen(PORT, () => {
      console.log(`IBMS server is working at PORT: ${PORT}`);
    });
  } catch (error) {
    console.log('START ERROR: ', error);
  }
})();
