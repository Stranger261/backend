import dotenv from 'dotenv';
import { sequelize, setupAssociations } from '../../shared/models/index.js';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 56739;
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
      console.log(`KIOSK server is working at PORT: ${PORT}`);
    });
  } catch (error) {
    console.error('Server failed to start.');
    process.exit(1);
  }
})();
