import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import * as erController from '../controllers/er.controller.js';

const router = express.Router();

// ER Visit Routes
router.post('/visits', authenticate, erController.createERVisit);
router.get('/visits', authenticate, erController.getAllERVisits);
router.get('/visits/:id', authenticate, erController.getERVisitById);
router.put('/visits/:id', authenticate, erController.updateERVisit);
router.patch('/visits/:id/status', authenticate, erController.updateERStatus);
router.delete('/visits/:id', authenticate, erController.deleteERVisit);

// Get visits by status
router.get(
  '/visits/status/:status',
  authenticate,
  erController.getERVisitsByStatus,
);

// Get visits by patient
router.get(
  '/patient/:patientId/visits',
  authenticate,
  erController.getERVisitsByPatient,
);

// Triage Routes
router.post('/triage', authenticate, erController.createTriageAssessment);
router.get('/triage/:erVisitId', authenticate, erController.getTriageByVisit);
router.put('/triage/:id', erController.updateTriageAssessment);

// Treatment Routes
router.post('/treatments', authenticate, erController.createTreatment);
router.get(
  '/treatments/visit/:erVisitId',
  authenticate,
  erController.getTreatmentsByVisit,
);
router.put('/treatments/:id', authenticate, erController.updateTreatment);
router.delete('/treatments/:id', authenticate, erController.deleteTreatment);

// Dashboard/Statistics Routes
router.get('/dashboard/stats', authenticate, erController.getDashboardStats);
router.get(
  '/dashboard/waiting-times',
  authenticate,
  erController.getWaitingTimes,
);
router.get(
  '/dashboard/triage-distribution',
  authenticate,
  erController.getTriageDistribution,
);

// Unknown/Temporary Patient Routes
router.post('/unknown-patient', erController.createUnknownPatient);
router.post(
  '/unknown-patient/:patientId/identify',
  erController.identifyUnknownPatient,
);
router.get('/unknown-patients', erController.getUnknownPatients);

// Discharge/Disposition Routes
router.post('/visits/:id/discharge', erController.dischargePatient);
router.post('/visits/:id/admit', erController.admitPatient);
router.post('/visits/:id/transfer', erController.transferPatient);

export default router;
