import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import errorHandler from '../../shared/middleware/errorHandler.middleware.js';

import appointmentRoutes from './routes/appointment.route.js';
import doctorRoutes from './routes/doctor.route.js';
import dashboardRoutes from './routes/dashboard.route.js';
import appointmentVitalsRoute from './routes/appointmentVitals.route.js';
import appointmentDiagnosisRoute from './routes/appointmentDiagnosis.route.js';
import appointmentConsultationRoute from './routes/appointmentConsultation.route.js';
import prescriptionRoute from './routes/prescription.route.js';
import labRoute from './routes/laboratory.route.js';

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
  }),
);
app.use(cookieParser());

app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
// Consultation-related routes
app.use('/api/v1/appointment-vitals', appointmentVitalsRoute);
app.use('/api/v1/appointment-diagnosis', appointmentDiagnosisRoute);
app.use('/api/v1/appointment-consultation', appointmentConsultationRoute);
app.use('/api/v1/prescriptions', prescriptionRoute);
app.use('/api/v1/lab', labRoute);

app.use(errorHandler);

export default app;
