import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import ERService from '../services/er.service.js';

// ========== ER Visit Controllers ==========

export const createERVisit = asyncHandler(async (req, res) => {
  const visitData = req.body;
  const result = await ERService.createERVisit(visitData);

  messageSender(201, 'ER visit created successfully', result, res);
});

export const getAllERVisits = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate,
    triageLevel,
  } = req.query;

  const filters = {
    status,
    startDate,
    endDate,
    triageLevel,
  };

  const result = await ERService.getAllERVisits(filters, page, limit);

  messageSender(200, 'Fetched successfully.', result, res);
});

export const getERVisitById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const visit = await ERService.getERVisitById(id);

  messageSender(200, 'Fetched successfully.', visit, res);
});

export const updateERVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const visit = await ERService.updateERVisit(id, updateData);

  messageSender(200, 'ER visit updated successfully', visit, res);
});

export const updateERStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const visit = await ERService.updateERStatus(id, status, notes);

  messageSender(200, 'ER status updated successfully', visit, res);
});

export const deleteERVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await ERService.deleteERVisit(id);

  messageSender(200, 'ER visit deleted successfully', null, res);
});

export const getERVisitsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const visits = await ERService.getERVisitsByStatus(status);

  messageSender(200, 'Fetched successfully.', visits, res);
});

export const getERVisitsByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const result = await ERService.getERVisitsByPatient(patientId, page, limit);

  messageSender(200, 'Fetched successfully.', result, res);
});

// ========== Triage Controllers ==========

export const createTriageAssessment = asyncHandler(async (req, res) => {
  const triageData = req.body;
  const triage = await ERService.createTriageAssessment(triageData);

  messageSender(201, 'Triage assessment created successfully', triage, res);
});

export const getTriageByVisit = asyncHandler(async (req, res) => {
  const { erVisitId } = req.params;
  const triage = await ERService.getTriageByVisit(erVisitId);

  messageSender(200, 'Fetched successfully.', triage, res);
});

export const updateTriageAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const triage = await ERService.updateTriageAssessment(id, updateData);

  messageSender(200, 'Triage assessment updated successfully', triage, res);
});

// ========== Treatment Controllers ==========

export const createTreatment = asyncHandler(async (req, res) => {
  const treatmentData = req.body;
  const treatment = await ERService.createTreatment(treatmentData);

  messageSender(201, 'Treatment created successfully', treatment, res);
});

export const getTreatmentsByVisit = asyncHandler(async (req, res) => {
  const { erVisitId } = req.params;
  const treatments = await ERService.getTreatmentsByVisit(erVisitId);

  messageSender(200, 'Fetched successfully.', treatments, res);
});

export const updateTreatment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const treatment = await ERService.updateTreatment(id, updateData);

  messageSender(200, 'Treatment updated successfully', treatment, res);
});

export const deleteTreatment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await ERService.deleteTreatment(id);

  messageSender(200, 'Treatment deleted successfully', null, res);
});

// ========== Dashboard/Statistics Controllers ==========

export const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await ERService.getDashboardStats();

  messageSender(200, 'Dashboard statistics fetched successfully.', stats, res);
});

export const getWaitingTimes = asyncHandler(async (req, res) => {
  const waitingTimes = await ERService.getWaitingTimes();

  messageSender(200, 'Waiting times fetched successfully.', waitingTimes, res);
});

export const getTriageDistribution = asyncHandler(async (req, res) => {
  const distribution = await ERService.getTriageDistribution();

  messageSender(
    200,
    'Triage distribution fetched successfully.',
    distribution,
    res,
  );
});

// ========== Unknown Patient Controllers ==========

export const createUnknownPatient = asyncHandler(async (req, res) => {
  const { visitData, temporaryInfo } = req.body;
  const result = await ERService.createUnknownPatient(visitData, temporaryInfo);

  messageSender(201, 'Unknown patient registered successfully', result, res);
});

export const identifyUnknownPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { realPatientId, personData } = req.body;

  const result = await ERService.identifyUnknownPatient(
    patientId,
    realPatientId,
    personData,
  );

  messageSender(200, 'Patient identified successfully', result, res);
});

export const getUnknownPatients = asyncHandler(async (req, res) => {
  const patients = await ERService.getUnknownPatients();

  messageSender(200, 'Unknown patients fetched successfully.', patients, res);
});

// ========== Discharge/Disposition Controllers ==========

export const dischargePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { dispositionType, instructions, followUp } = req.body;

  const visit = await ERService.dischargePatient(id, {
    dispositionType: dispositionType || 'home',
    instructions,
    followUp,
  });

  messageSender(200, 'Patient discharged successfully', visit, res);
});

export const admitPatient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ward, bed, admittingDiagnosis } = req.body;

  const visit = await ERService.admitPatient(id, {
    ward,
    bed,
    admittingDiagnosis,
  });

  messageSender(200, 'Patient admitted successfully', visit, res);
});

export const transferPatient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { facility, reason, transportMode } = req.body;

  const visit = await ERService.transferPatient(id, {
    facility,
    reason,
    transportMode,
  });

  messageSender(200, 'Patient transferred successfully', visit, res);
});
