import express from 'express';
import {
  authenticate,
  authorizeRole,
} from '../../../shared/middleware/auth.middleware.js';
import * as progressNoteController from '../controllers/progressNote.controller.js';

const router = express.Router();

router.post(
  '/create',
  [authenticate, authorizeRole('doctor', 'nurse')],
  progressNoteController.createProgressNote,
);

// Amend progress note (instead of update)
router.post(
  '/:noteId/amend',
  [authenticate, authorizeRole('doctor', 'nurse', 'admin')],
  progressNoteController.amendProgressNote,
);

// delete note
router.delete(
  '/:noteId',
  [authenticate, authorizeRole('doctor', 'nurse', 'admin')],
  progressNoteController.deleteProgressNote,
);

// get vitals using admission id
router.get(
  '/admission/:admissionId/vitals',
  [authenticate, authorizeRole('doctor', 'nurse')],
  progressNoteController.getVitalSignHistory,
);

// get latest admission admission id
router.get(
  '/admission/:admissionId/latest',
  [authenticate, authorizeRole('doctor', 'nurse')],
  progressNoteController.getLatestProgressNote,
);

// Get vitals trend with comparisons
router.get(
  '/admission/:admissionId/vitals-trend',
  [authenticate, authorizeRole('doctor', 'nurse', 'admin')],
  progressNoteController.getVitalsTrendWithComparison,
);

// get admission admission id
router.get(
  '/admission/:admissionId',
  [authenticate, authorizeRole('doctor', 'nurse')],
  progressNoteController.getAdmissionProgressNotes,
);

// get note using note id
router.get(
  '/:noteId',
  [authenticate, authorizeRole('doctor', 'nurse')],
  progressNoteController.getProgressNoteById,
);

// Get note with amendment history
router.get(
  '/:noteId/history',
  [authenticate, authorizeRole('doctor', 'nurse', 'admin')],
  progressNoteController.getProgressNoteWithHistory,
);

export default router;
