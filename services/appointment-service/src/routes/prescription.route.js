import express from 'express';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import * as prescriptionController from '../controllers/prescription.controller.js';

const router = express.Router();

// Create prescription (Doctor only)
router.post(
  '/',
  [authenticate, authorizeRole('doctor')],
  prescriptionController.createPrescription,
);

// Get prescription by ID
router.get(
  '/:prescriptionId',
  [authenticate, authorizeRole('doctor', 'nurse', 'pharmacist')],
  prescriptionController.getPrescriptionById,
);

// Get patient prescriptions
router.get(
  '/patient/:patientId',
  [authenticate, authorizeRole('doctor', 'nurse', 'pharmacist')],
  prescriptionController.getPatientPrescriptions,
);

// Dispense medication (Pharmacist only)
router.patch(
  '/item/:itemId/dispense',
  [authenticate, authorizeRole('pharmacist')],
  prescriptionController.dispenseMedication,
);

export default router;
