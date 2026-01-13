import dotenv from 'dotenv';
import app from './app.js';
import { sequelize, setupAssociations } from '../../shared/models/index.js';

dotenv.config();

const PORT = process.env.PORT || 56738;

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
      console.log(`Auth server is working at PORT ${PORT}`);
    });
  } catch (error) {
    console.log('Server error: ', error);
    console.error(error);
    process.exit(1);
  }
})();
