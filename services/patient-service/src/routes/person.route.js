import express from 'express';

import * as personController from '../controllers/person.controller.js';

import {
  authenticate,
  protectInternalApi,
} from '../../../shared/middleware/auth.middleware.js';
import { attachRequestInfo } from '../../../shared/middleware/attachReqInfo.middleware.js';

const router = express.Router();

router.post(
  '/register',
  [attachRequestInfo, protectInternalApi],
  personController.registerPerson,
);

router.post(
  '/register/walk-in',
  [attachRequestInfo, authenticate],
  personController.registerPersonWalkIn,
);

router.post(
  '/verify-face',
  [protectInternalApi],
  personController.verifyPersonFace,
);

// external
router.get(
  '/external/user/:userUUID',
  [protectInternalApi],
  personController.getPerson,
);

export default router;
