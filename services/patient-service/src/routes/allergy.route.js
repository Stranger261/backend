import express from 'express';
import allergyController from '../controllers/allergy.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/allergies - Get all patient allergies
router.get('/:userUuid/all', allergyController.getPatientAllergies);

// GET /api/allergies/critical - Get critical allergies
router.get('/:userUuid/critical', allergyController.getCriticalAllergies);

// POST /api/allergies - Add new allergy
router.post('/:userUuid/create', allergyController.addAllergy);

// PATCH /api/allergies/:allergyId - Update allergy
router.patch('/:userUuid/:allergyId/update', allergyController.updateAllergy);

// DELETE /api/allergies/:allergyId - Delete allergy
router.delete('/:userUuid/:allergyId/delete', allergyController.deleteAllergy);

export default router;
