import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import BedService from '../services/bed.service.js';

export const getFloorSummary = asyncHandler(async (req, res) => {
  const floorSummary = await BedService.getFloorSummary();

  messageSender(200, 'Fetched successfully.', floorSummary, res);
});

export const getRoomsSummary = asyncHandler(async (req, res) => {
  const { floorNumber } = req.params;
  const roomsSummary = await BedService.getRoomsSummary(floorNumber);

  messageSender(200, 'Fetched successfully.', roomsSummary, res);
});

export const getRoomsBeds = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const roomBeds = await BedService.getRoomBeds(roomId);

  messageSender(200, 'Fetched successfully.', roomBeds, res);
});

export const getAvailableBed = asyncHandler(async (req, res) => {
  const { bedType, floor, roomType } = req.params;

  const availableBeds = await BedService.getAvailableBed(
    bedType,
    floor,
    roomType,
  );

  messageSender(200, 'Fetched successfully.', availableBeds, res);
});

export const getBedDetails = asyncHandler(async (req, res) => {
  const { bedId } = req.params;

  const bedDetails = await BedService.getBedDetails(bedId);

  messageSender(200, 'Fetched successfully.', bedDetails, res);
});

export const getAllBeds = asyncHandler(async (req, res) => {
  const { status, bedType, floor } = req.query;
  const beds = await bedService.getAllBeds({ status, bedType, floor });
  messageSender(200, 'Beds fetched successfully.', beds, res);
});

// updates
export const updateBedStatus = asyncHandler(async (req, res) => {
  const { bedId } = req.params;
  const { status, reason } = req.body;

  const newBedDetails = await BedService.updateBedStatus(
    bedId,
    status,
    reason,
    req?.user?.staff_id,
  );

  messageSender(200, 'Updated successfully.', newBedDetails, res);
});

export const markBedForMaintenance = asyncHandler(async (req, res) => {
  const { bedId } = req.params;
  const { reason } = req.body;

  const bed = await BedService.markBedForMaintenance(
    parseInt(bedId),
    reason,
    req.user.staff_id,
  );

  messageSender(200, 'Bed marked for maintenance.', bed, res);
});

export const markBedCleaned = asyncHandler(async (req, res) => {
  const { bedId } = req.params;

  const bed = await BedService.markBedCleaned(
    parseInt(bedId),
    req.user.staff_id,
  );

  messageSender(200, 'Bed marked as cleaned and available.', bed, res);
});

export const reserveBed = asyncHandler(async (req, res) => {
  const { bedId } = req.params;
  const { reason } = req.body;

  const bed = await BedService.reserveBed(
    parseInt(bedId),
    req.user.staff_id,
    reason,
  );

  messageSender(200, 'Bed reserved successfully.', bed, res);
});

export const cancelBedReservation = asyncHandler(async (req, res) => {
  const { bedId } = req.params;
  const { reason } = req.body;

  const bed = await BedService.cancelBedReservation(
    parseInt(bedId),
    req.user.staff_id,
    reason,
  );

  messageSender(200, 'Bed reservation cancelled.', bed, res);
});

// Statistics
export const getBedOccupancyStats = asyncHandler(async (req, res) => {
  const stats = await BedService.getBedOccupancyStats();
  messageSender(200, 'Bed occupancy statistics fetched.', stats, res);
});

export const getBedsRequiringAttention = asyncHandler(async (req, res) => {
  const beds = await BedService.getBedsRequiringAttention();
  messageSender(200, 'Beds requiring attention fetched.', beds, res);
});

// bed history
export const getBedStatusHistory = asyncHandler(async (req, res) => {
  const { bedId } = req.params;
  const { limit } = req.query;

  const history = await BedService.getBedStatusHistory(
    parseInt(bedId),
    limit ? parseInt(limit) : 50,
  );

  messageSender(200, 'Bed status history fetched successfully.', history, res);
});

export const getRecentStatusChanges = asyncHandler(async (req, res) => {
  const { hours } = req.query;

  const changes = await BedService.getRecentStatusChanges(
    hours ? parseInt(hours) : 24,
  );

  messageSender(
    200,
    'Recent status changes fetched successfully.',
    changes,
    res,
  );
});
