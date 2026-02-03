import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import progressNoteService from '../services/progressNote.service.js';

export const createProgressNote = asyncHandler(async (req, res) => {
  const { noteData } = req.body;
  const staffId = req?.user?.staff_id;

  const note = await progressNoteService.createProgressNote(noteData, staffId);

  messageSender(201, 'Progress note created successfully.', note, res);
});

export const amendProgressNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const StaffId = req?.user?.staff_id;
  const { amendmentData } = req.body;
  const amendedNote = await progressNoteService.amendProgressNote(
    noteId,
    amendmentData,
    StaffId,
  );

  messageSender(200, 'Progress note amended successfully.', amendedNote, res);
});

export const deleteProgressNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const staffId = req?.user?.staff_id;
  const { reason } = req.body.data;

  const note = await progressNoteService.deleteProgressNote(
    noteId,
    staffId,
    reason,
  );

  messageSender(200, 'Note deleted successfully.', note, res);
});

export const getProgressNoteById = asyncHandler(async (req, res) => {
  const { noteId } = req.params;

  const note = await progressNoteService.getProgressNoteById(noteId);

  messageSender(200, 'Progress note fetched successfully.', note, res);
});

export const getAdmissionProgressNotes = asyncHandler(async (req, res) => {
  const filters = req.query;
  const { admissionId } = req.params;

  const note = await progressNoteService.getAdmissionProgressNotes(
    admissionId,
    filters,
  );

  messageSender(
    200,
    'Progress admission notes fetched successfully.',
    note,
    res,
  );
});

export const getVitalSignHistory = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;
  const vitals = await progressNoteService.getVitalSignHistory(admissionId);

  messageSender(200, 'Progress note created successfully.', vitals, res);
});

export const getLatestProgressNote = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;

  const note = await progressNoteService.getLatestProgressNote(admissionId);

  messageSender(200, 'Progress note fetched successfully.', note, res);
});

export const getProgressNoteWithHistory = asyncHandler(async (req, res) => {
  const { noteId } = req.params;

  const note = await progressNoteService.getProgressNoteWithHistory(noteId);

  messageSender(200, 'Fetched succesfully.', note, res);
});

export const getVitalsTrendWithComparison = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;
  const { limit = 20 } = req.query;

  const vitals = await progressNoteService.getVitalsTrendWithComparison(
    admissionId,
    limit,
  );

  messageSender(200, 'Fetched succesfully.', vitals, res);
});
