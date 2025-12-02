import express from 'express';
import {
  detectFace,
  compareFaces,
  verifyUserFace,
  healthCheck,
} from '../controllers/facePlusPlus.controller.js';
import { attachRequestInfo } from '../../../shared/middleware/attachReqInfo.middleware.js';
import {
  protectInternalApi,
  authenticate,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// Face detection endpoint
router.post('/detect', detectFace);

// Face comparison endpoint
router.post('/compare', compareFaces);

// Complete face verification endpoint
router.post(
  '/verify',
  [authenticate, protectInternalApi, attachRequestInfo],
  verifyUserFace
);

// Health check endpoint
router.get('/health', healthCheck);

export default router;
