import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import * as updatePersonController from '../controllers/updatePerson.controller.js';

const router = express.Router();

router.patch(
  '/:userUuid/update-contacts',
  authenticate,
  updatePersonController.updateContacts
);

router.patch(
  '/:userUuid/update-email',
  authenticate,
  updatePersonController.updateEmail
);

router.patch(
  '/:userUuid/update-civil_status',
  authenticate,
  updatePersonController.updateCivilStatus
);

router.patch(
  '/:userUuid/update-address',
  authenticate,
  updatePersonController.updateAddress
);

router.patch(
  '/:userUuid/update-height',
  authenticate,
  updatePersonController.updateHeight
);

router.patch(
  '/:userUuid/update-weight',
  authenticate,
  updatePersonController.updateWeight
);

router.patch(
  '/:userUuid/update-allergies',
  authenticate,
  updatePersonController.updateAllergies
);

router.patch(
  '/:userUuid/update-chronic_conditions',
  authenticate,
  updatePersonController.updateChronicConditions
);

router.patch(
  '/:userUuid/update-current_medication',
  authenticate,
  updatePersonController.updateCurrentMedications
);

router.patch(
  '/:userUuid/update-insurance_provider',
  authenticate,
  updatePersonController.updateInsuranceProvider
);

router.patch(
  '/:userUuid/update-insurance_number',
  authenticate,
  updatePersonController.updateInsuranceNumber
);

router.patch(
  '/:userUuid/update-insurance_expiry',
  authenticate,
  updatePersonController.updateInsuranceExpiry
);
export default router;
