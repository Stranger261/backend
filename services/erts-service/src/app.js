import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import erRoute from './routes/er.route.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(
  cors({
    origin: ['https://core1.health-ease-hospital.com', 'http://localhost:5173'],
    credentials: true,
  }),
);
app.use(cookieParser());

app.use('/api/v1/er', erRoute);

app.use(errorHandler);

export default app;
