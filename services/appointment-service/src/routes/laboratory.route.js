import express from 'express';
import {
  createLabOrder,
  getLabOrder,
  getLabOrdersByAppointment,
  getLabOrdersByPatient,
  getAllLabOrders,
  updateLabOrder,
  updateLabResults,
  cancelLabOrder,
  getLabOrderTests,
  getAllLabServices,
  receiever,
} from '../controllers/laboratory.controller.js';
import {
  authenticate,
  authorizeRole,
  protectInternalApi,
} from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.post('/external/lab', protectInternalApi, receiever);
// All routes require authentication
router.use(authenticate);

// Create lab order (doctors only)
router.post('/', createLabOrder);

// Get all lab orders (admin, lab technicians)
router.get('/', getAllLabOrders);

// Get lab order by ID
router.get('/:orderId', getLabOrder);

// Get lab orders by appointment
router.get('/appointment/:appointmentId', getLabOrdersByAppointment);

// Get lab orders by patient
router.get('/patient/:patientId', getLabOrdersByPatient);

// Get lab order tests
router.get('/:orderId/tests', getLabOrderTests);

// Update lab order
router.put('/:orderId', updateLabOrder);

// Update lab results
router.put('/:orderId/results', updateLabResults);

// Cancel lab order
router.delete('/:orderId', authorizeRole('admin', 'doctor'), cancelLabOrder);

// services
router.get('/all/services', authenticate, getAllLabServices);

export default router;
