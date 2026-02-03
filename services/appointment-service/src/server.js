import dotenv from 'dotenv';

import app from './app.js';
import sequelize from '../../shared/config/db.config.js';
import { setupAssociations } from '../../shared/models/index.js';
import appointmentReminderService from './services/appointmentReminder.service.js';

dotenv.config();

const PORT = process.env.PORT || 56733;

// for cron
appointmentReminderService;

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
      console.log(`Appointment service is working at PORT: ${PORT}`);
    });
  } catch (error) {
    console.log('Server error: ', error);
  }
})();
