import dotenv from 'dotenv';

import app from './app.js';
import { sequelize, setupAssociations } from '../../shared/models/index.js';

dotenv.config();

const PORT = process.env.PORT || 56737;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    setupAssociations();
    console.log('✅ Model associations configured.');

    if (process.env.DEVELOPMENT === 'development') {
      await sequelize.sync({ force: false });
      console.log('✅ Database synced.');
    }

    app.listen(PORT, () => {
      console.log('Notification port is working at :', PORT);
    });
  } catch (error) {
    console.error(error);
  }
})();
