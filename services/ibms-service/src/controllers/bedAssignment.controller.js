import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import bedAssignmentService from '../services/bedAssignment.service.js';

export const assignBed = asyncHandler(async (req, res) => {
  const { admissionId, bedId, assignedBy } = req.body;
  const assignment = await bedAssignmentService.assignBedToAdmission(
    admissionId,
    bedId,
    assignedBy || req.user?.staff_id,
  );

  messageSender(201, 'Bed assigned successfully.', assignment, res);
});

export const releaseBed = asyncHandler(async (req, res) => {
  const { admissionId, reason } = req.body.data;

  const result = await bedAssignmentService.releaseBedFromAdmission(
    admissionId,
    reason,
  );

  messageSender(200, 'Bed released successfully.', result, res);
});

export const transferBed = asyncHandler(async (req, res) => {
  const { admissionId, newBedId, reason } = req.body.data;

  const assignment = await bedAssignmentService.transferBed(
    admissionId,
    newBedId,
    req.user.staff_id,
    reason,
  );

  messageSender(200, 'Bed transferred successfully.', assignment, res);
});

export const getCurrentBed = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;

  const bedInfo =
    await bedAssignmentService.getCurrentBedAssignment(admissionId);

  messageSender(200, 'Current bed fetched successfully.', bedInfo, res);
});

export const getBedHistory = asyncHandler(async (req, res) => {
  const { admissionId } = req.params;

  const history =
    await bedAssignmentService.getBedAssignmentHistory(admissionId);

  messageSender(
    200,
    'Bed assignment history fetched successfully.',
    history,
    res,
  );
});

export const markBedCleaned = asyncHandler(async (req, res) => {
  const { bedId } = req.params;

  const bed = await bedAssignmentService.markBedCleaned(
    bedId,
    req.user.staff_id,
  );

  messageSender(200, 'Bed marked as cleaned and available.', bed, res);
});

export const getAllAdmissions = asyncHandler(async (req, res) => {
  const filters = req.query;

  const activeAdmission = await bedAssignmentService.getAllAdmissions(filters);

  messageSender(200, 'Fetched successfully..', activeAdmission, res);
});
