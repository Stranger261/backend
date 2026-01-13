import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import videoRouter from './routes/videocall.route.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://192.168.100.11:5173',
      'https://core1.health-ease-hospital.com',
      'https://pessimistically-sociogenic-misha.ngrok-free.dev',
    ],
    credentials: true,
  })
);
app.use(cookieParser());

app.use('/api/v1/online-video', videoRouter);

app.use(errorHandler);

export default app;
