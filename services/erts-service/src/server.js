import dotenv from 'dotenv';
import sequelize from '../../shared/config/db.config.js';
import app from './app.js';
import { setupAssociations } from '../../shared/models/index.js';

dotenv.config();

const PORT = process.env.PORT || 56735;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    setupAssociations();
    console.log('✅ Model associations configured.');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: false });
      console.log('✅ Database synced.');
    }

    app.listen(PORT, () => {
      console.log(`ERTS server is working at PORT: ${PORT}`);
    });
  } catch (error) {
    console.log('START ERROR: ', error);
  }
})();
