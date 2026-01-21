import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import kioskRoute from './routes/kiosk.route.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://192.168.100.11:5173',
      'https://core1.health-ease-hospital.com',
      'https://kiosk.face-scan.health-ease-hospital.com',
    ],
    credentials: true,
    methods: ['GET', 'PATCH', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
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
      'face-service-key',
    ],
    preflightContinue: true,
    optionsSuccessStatus: 204,
  })
);

app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/v1/kiosk', kioskRoute);

app.use(errorHandler);

export default app;
