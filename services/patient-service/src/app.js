import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import facePlusPlusRoutes from './routes/facePlusPlus.route.js';
import addressRoutes from './routes/address.route.js';
import personRoutes from './routes/person.route.js';
import patientRoutes from './routes/patient.route.js';
import updateRoutes from './routes/updatePerson.route.js';
import allergyRoute from './routes/allergy.route.js';

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://192.168.100.11:5173',
      'https://core1.health-ease-hospital.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie',
      'x-internal-api-key',
      'X-internal-Api-key',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Credentials',
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie',
      'x-internal-api-key',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cookieParser());

app.use('/api/v1/faceplusplus', facePlusPlusRoutes);
app.use('/api/v1/address', addressRoutes);
app.use('/api/v1/person', personRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/updatePerson', updateRoutes);
app.use('/api/v1/allergies', allergyRoute);

app.use(errorHandler);

export default app;
