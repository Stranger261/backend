import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import kioskService from '../services/kiosk.service.js';

export const verifyAppointmentArrival = asyncHandler(async (req, res) => {
  const { livePhotoBase64 } = req.body;

  const appointment = await kioskService.verifyAppointmentArrival(
    livePhotoBase64
  );

  messageSender(
    200,
    'Check-in successful! Patient marked as arrived.',
    appointment,
    res
  );
});
