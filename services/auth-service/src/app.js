import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';
// routes
import authRoutes from './routes/auth.route.js';
import authRegistrationRoutes from './routes/authRegistration.route.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/registration', authRegistrationRoutes);

app.use(errorHandler);

export default app;
