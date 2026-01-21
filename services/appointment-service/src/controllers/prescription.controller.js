import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import prescriptionService from '../services/prescription.service.js';

export const createPrescription = asyncHandler(async (req, res) => {
  const doctorStaffId = req.staff.staff_id;
  const prescriptionData = req.body;

  const prescription = await prescriptionService.createPrescription(
    prescriptionData,
    doctorStaffId,
  );

  messageSender(201, 'Prescription created successfully.', prescription, res);
});

export const getPrescriptionById = asyncHandler(async (req, res) => {
  const { prescriptionId } = req.params;

  const prescription =
    await prescriptionService.getPrescriptionById(prescriptionId);

  messageSender(200, 'Prescription fetched successfully.', prescription, res);
});

export const getPatientPrescriptions = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { activeOnly } = req.query;

  const prescriptions = await prescriptionService.getPatientPrescriptions(
    patientId,
    activeOnly === 'true',
  );

  messageSender(200, 'Prescriptions fetched successfully.', prescriptions, res);
});

export const dispenseMedication = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const pharmacistStaffId = req.staff.staff_id;

  const item = await prescriptionService.dispenseMedication(
    itemId,
    pharmacistStaffId,
  );

  messageSender(200, 'Medication dispensed successfully.', item, res);
});
