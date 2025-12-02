import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import facePlusPlusRoutes from './routes/facePlusPlus.route.js';
import addressRoutes from './routes/address.route.js';
import personRoutes from './routes/person.route.js';

const app = express();

// 1. Apply CORS FIRST - this handles preflight automatically
app.use(
  cors({
    origin: ['http://localhost:5173', 'https://core1.health-ease-hospital.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// 2. Increase payload limits for JSON (Face++ base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 3. Cookie parser
app.use(cookieParser());

// 4. Your routes
app.use('/api/v1/faceplusplus', facePlusPlusRoutes);
app.use('/api/v1/address', addressRoutes);
app.use('/api/v1/person', personRoutes);

// 5. Health check endpoint to test connectivity
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Patient service is running',
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: [
        'http://localhost:5173',
        'https://core1.health-ease-hospital.com',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
  });
});

// 6. Global error handler
app.use(errorHandler);

export default app;
