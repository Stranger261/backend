import allergyService from '../services/allergy.service.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';

class AllergyController {
  getPatientAllergies = asyncHandler(async (req, res) => {
    const { userUuid } = req.params;

    const allergies = await allergyService.getPatientAllergies(userUuid);

    messageSender(200, 'Allergies retrieved successfully', allergies, res);
  });

  getCriticalAllergies = asyncHandler(async (req, res) => {
    const { userUuid } = req.params;

    const allergies = await allergyService.getCriticalAllergies(userUuid);

    messageSender(
      200,
      'Critical allergies retrieved successfully',
      allergies,
      res
    );
  });

  addAllergy = asyncHandler(async (req, res) => {
    const { userUuid } = req.params;
    const { allergyData } = req.body;

    const allergy = await allergyService.addAllergy(userUuid, allergyData);

    messageSender(201, 'Allergy added successfully', allergy, res);
  });

  updateAllergy = asyncHandler(async (req, res) => {
    const { userUuid } = req.params;
    const { allergyId } = req.params;
    const { updatedAllergy } = req.body;

    const allergy = await allergyService.updateAllergy(
      userUuid,
      allergyId,
      updatedAllergy
    );

    messageSender(200, 'Allergy updated successfully', allergy, res);
  });

  deleteAllergy = asyncHandler(async (req, res) => {
    const { userUuid, allergyId } = req.params;
    await allergyService.deleteAllergy(userUuid, allergyId);

    messageSender(200, 'Allergy deleted successfully', {}, res);
  });
}

export default new AllergyController();
