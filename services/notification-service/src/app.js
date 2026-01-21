import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import notificationRoute from './routes/notification.route.js';

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://192.168.100.11:5173',
      'https://core1.health-ease-hospital.com',
      'https://http://kiosk.face-scan.health-ease-hospital.com/',
    ],
    credentials: true,
  })
);

app.use(cookieParser());

app.use('/api/v1/notifications', notificationRoute);

app.use(errorHandler);

export default app;
