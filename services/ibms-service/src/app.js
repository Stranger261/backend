import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import bedRoute from './routes/bed.route.js';
import bedAssignmentRoute from './routes/bedAssignment.route.js';
import progressNote from './routes/progressNote.route.js';
import doctorAdmission from './routes/doctorAdmission.route.js';
import bedStats from './routes/bedStats.route.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(
  cors({
    origin: [
      'https://core1.health-ease-hospital.com',
      'http://localhost:5173',
      'http://192.168.100.11:5173',
    ],
    credentials: true,
  }),
);
app.use(cookieParser());

app.use('/api/v1/bed', bedRoute);
app.use('/api/v1/bedAssignment', bedAssignmentRoute);
app.use('/api/v1/progressNote', progressNote);
app.use('/api/v1/doctorAdmission', doctorAdmission);
app.use('/api/v1/bedStats', bedStats);

app.use(errorHandler);

export default app;
