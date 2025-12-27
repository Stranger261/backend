import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import appointmentRoutes from './routes/appointment.route.js';
import doctorRoutes from './routes/doctor.route.js';

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://192.168.100.11:5173',
      'https://core1.health-ease-hospital.com',
    ],
    credentials: true,
  })
);
app.use(cookieParser());

app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);

app.use(errorHandler);

export default app;
