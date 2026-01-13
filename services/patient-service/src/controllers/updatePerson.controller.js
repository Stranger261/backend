import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import updatePersonService from '../services/updatePerson.service.js';

export const updateContacts = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedContacts } = req.body;

  const updatedUser = await updatePersonService.updateContacts(
    userUuid,
    updatedContacts
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateEmail = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedEmail } = req.body;
  const updatedUser = await updatePersonService.updateEmail(
    userUuid,
    updatedEmail
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateCivilStatus = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedStatus } = req.body;

  const updatedUser = await updatePersonService.updateCivilStatus(
    userUuid,
    updatedStatus
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateAddress = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedAddress } = req.body;

  const updatedUser = await updatePersonService.updateAddress(
    userUuid,
    updatedAddress
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateHeight = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedHeight } = req.body;

  console.log('height called');
  const updatedUser = await updatePersonService.updateHeight(
    userUuid,
    updatedHeight
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateWeight = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedWeight } = req.body;
  console.log('called');

  const updatedUser = await updatePersonService.updateWeight(
    userUuid,
    updatedWeight
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateAllergies = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedAllergies } = req.body;

  const updatedUser = await updatePersonService.updateAllergies(
    userUuid,
    updatedAllergies
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateChronicConditions = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedChronicConditions } = req.body;

  const updatedUser = await updatePersonService.updateChronicConditions(
    userUuid,
    updatedChronicConditions
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateCurrentMedications = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedCurrentMedications } = req.body;

  const updatedUser = await updatePersonService.updateCurrentMedications(
    userUuid,
    updatedCurrentMedications
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateInsuranceProvider = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedInsuranceProvider } = req.body;

  const updatedUser = await updatePersonService.updateInsuranceProvider(
    userUuid,
    updatedInsuranceProvider
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateInsuranceNumber = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedInsuranceNumber } = req.body;

  const updatedUser = await updatePersonService.updateInsuranceNumber(
    userUuid,
    updatedInsuranceNumber
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});

export const updateInsuranceExpiry = asyncHandler(async (req, res) => {
  const { userUuid } = req.params;
  const { updatedInsuranceExpiry } = req.body;

  const updatedUser = await updatePersonService.updateInsuranceExpiry(
    userUuid,
    updatedInsuranceExpiry
  );

  messageSender(200, 'User updated successfully.', updatedUser, res);
});
