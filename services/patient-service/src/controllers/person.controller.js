import personService from '../services/person.service.js';

import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';

export const registerPerson = asyncHandler(async (req, res) => {
  const { ipAddress, userAgent } = req.clientInfo;

  const data = { ...req.body, ipAddress, userAgent };

  const newPerson = await personService.registerPerson(data);

  messageSender(
    201,
    newPerson.message || 'New person created successfully.',
    newPerson,
    res
  );
});

export const verifyPersonFace = asyncHandler(async (req, res) => {
  const { userUUID, livePhotoBase64, ipAddress, userAgent } = req.body;

  const result = await personService.verifyPersonFace({
    userUUID,
    livePhotoBase64,
    ipAddress,
    userAgent,
  });

  messageSender(200, 'Face verified successfully.', result, res);
});

export const getPerson = asyncHandler(async (req, res) => {
  const { userUUID } = req.params;

  const person = await personService.getPerson(userUUID);

  messageSender(200, 'Person retrieved successfully.', person, res);
});
