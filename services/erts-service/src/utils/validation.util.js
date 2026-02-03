import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

/**
 * ER Visit Validations
 */
export const validateCreateERVisit = [
  body('patient_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Patient ID must be a positive integer'),

  body('arrival_mode')
    .notEmpty()
    .withMessage('Arrival mode is required')
    .isIn(['ambulance', 'walk_in', 'police', 'helicopter', 'other'])
    .withMessage('Invalid arrival mode'),

  body('chief_complaint')
    .notEmpty()
    .withMessage('Chief complaint is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Chief complaint must be between 5 and 1000 characters'),

  body('accompanied_by')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Accompanied by must not exceed 255 characters'),

  body('triage_level')
    .notEmpty()
    .withMessage('Triage level is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Triage level must be between 1 and 5'),

  body('triage_nurse_id')
    .notEmpty()
    .withMessage('Triage nurse ID is required')
    .isInt({ min: 1 })
    .withMessage('Triage nurse ID must be a positive integer'),

  body('assigned_doctor_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assigned doctor ID must be a positive integer'),

  body('er_status')
    .optional()
    .isIn([
      'waiting',
      'in_treatment',
      'admitted',
      'discharged',
      'transferred',
      'left_ama',
      'deceased',
    ])
    .withMessage('Invalid ER status'),

  handleValidationErrors,
];

export const validateUpdateERVisit = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ER visit ID'),

  body('chief_complaint')
    .optional()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Chief complaint must be between 5 and 1000 characters'),

  body('triage_level')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Triage level must be between 1 and 5'),

  body('assigned_doctor_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assigned doctor ID must be a positive integer'),

  handleValidationErrors,
];

export const validateUpdateERStatus = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ER visit ID'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn([
      'waiting',
      'in_treatment',
      'admitted',
      'discharged',
      'transferred',
      'left_ama',
      'deceased',
    ])
    .withMessage('Invalid ER status'),

  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),

  handleValidationErrors,
];

/**
 * Triage Validations
 */
export const validateCreateTriage = [
  body('er_visit_id')
    .notEmpty()
    .withMessage('ER visit ID is required')
    .isInt({ min: 1 })
    .withMessage('ER visit ID must be a positive integer'),

  body('assessed_by')
    .notEmpty()
    .withMessage('Assessed by is required')
    .isInt({ min: 1 })
    .withMessage('Assessed by must be a positive integer'),

  body('vital_signs')
    .notEmpty()
    .withMessage('Vital signs are required')
    .isObject()
    .withMessage('Vital signs must be an object'),

  body('vital_signs.blood_pressure')
    .optional()
    .matches(/^\d{2,3}\/\d{2,3}$/)
    .withMessage('Blood pressure must be in format XXX/XXX'),

  body('vital_signs.heart_rate')
    .optional()
    .isInt({ min: 20, max: 250 })
    .withMessage('Heart rate must be between 20 and 250'),

  body('vital_signs.respiratory_rate')
    .optional()
    .isInt({ min: 5, max: 60 })
    .withMessage('Respiratory rate must be between 5 and 60'),

  body('vital_signs.temperature')
    .optional()
    .isFloat({ min: 32, max: 45 })
    .withMessage('Temperature must be between 32°C and 45°C'),

  body('vital_signs.oxygen_saturation')
    .optional()
    .isInt({ min: 50, max: 100 })
    .withMessage('Oxygen saturation must be between 50 and 100'),

  body('pain_scale')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Pain scale must be between 0 and 10'),

  body('consciousness_level')
    .notEmpty()
    .withMessage('Consciousness level is required')
    .isIn(['alert', 'verbal', 'pain', 'unresponsive'])
    .withMessage('Invalid consciousness level'),

  body('presenting_symptoms')
    .notEmpty()
    .withMessage('Presenting symptoms are required')
    .isLength({ min: 5 })
    .withMessage('Presenting symptoms must be at least 5 characters'),

  body('triage_category')
    .notEmpty()
    .withMessage('Triage category is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Triage category must be between 1 and 5'),

  body('triage_color')
    .notEmpty()
    .withMessage('Triage color is required')
    .isIn(['red', 'orange', 'yellow', 'green', 'blue'])
    .withMessage('Invalid triage color'),

  handleValidationErrors,
];

/**
 * Treatment Validations
 */
export const validateCreateTreatment = [
  body('er_visit_id')
    .notEmpty()
    .withMessage('ER visit ID is required')
    .isInt({ min: 1 })
    .withMessage('ER visit ID must be a positive integer'),

  body('performed_by')
    .notEmpty()
    .withMessage('Performed by is required')
    .isInt({ min: 1 })
    .withMessage('Performed by must be a positive integer'),

  body('treatment_type')
    .notEmpty()
    .withMessage('Treatment type is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Treatment type must be between 3 and 100 characters'),

  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 5 })
    .withMessage('Description must be at least 5 characters'),

  body('medication_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Medication name must not exceed 100 characters'),

  body('dosage')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Dosage must not exceed 50 characters'),

  body('route')
    .optional()
    .isIn(['oral', 'IV', 'IM', 'subcutaneous', 'topical', 'inhalation'])
    .withMessage('Invalid medication route'),

  handleValidationErrors,
];

/**
 * Unknown Patient Validations
 */
export const validateCreateUnknownPatient = [
  body('visitData')
    .notEmpty()
    .withMessage('Visit data is required')
    .isObject()
    .withMessage('Visit data must be an object'),

  body('visitData.arrival_mode')
    .notEmpty()
    .withMessage('Arrival mode is required')
    .isIn(['ambulance', 'walk_in', 'police', 'helicopter', 'other'])
    .withMessage('Invalid arrival mode'),

  body('visitData.chief_complaint')
    .notEmpty()
    .withMessage('Chief complaint is required'),

  body('visitData.triage_level')
    .notEmpty()
    .withMessage('Triage level is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Triage level must be between 1 and 5'),

  body('temporaryInfo')
    .optional()
    .isObject()
    .withMessage('Temporary info must be an object'),

  body('temporaryInfo.estimatedAge')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('Estimated age must be between 0 and 120'),

  body('temporaryInfo.gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),

  handleValidationErrors,
];

export const validateIdentifyUnknownPatient = [
  param('patientId').isInt({ min: 1 }).withMessage('Invalid patient ID'),

  body().custom(value => {
    if (!value.realPatientId && !value.personData) {
      throw new Error('Either realPatientId or personData must be provided');
    }
    return true;
  }),

  body('realPatientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Real patient ID must be a positive integer'),

  body('personData')
    .optional()
    .isObject()
    .withMessage('Person data must be an object'),

  body('personData.first_name')
    .if(body('personData').exists())
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),

  body('personData.last_name')
    .if(body('personData').exists())
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),

  body('personData.date_of_birth')
    .if(body('personData').exists())
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),

  body('personData.gender')
    .if(body('personData').exists())
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),

  handleValidationErrors,
];

/**
 * Query Parameter Validations
 */
export const validateGetAllVisits = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn([
      'waiting',
      'in_treatment',
      'admitted',
      'discharged',
      'transferred',
      'left_ama',
      'deceased',
    ])
    .withMessage('Invalid status'),

  query('triageLevel')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Triage level must be between 1 and 5'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  handleValidationErrors,
];

/**
 * Disposition Validations
 */
export const validateDischarge = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ER visit ID'),

  body('dispositionType')
    .optional()
    .isIn(['home', 'admitted', 'transferred', 'ama', 'deceased'])
    .withMessage('Invalid disposition type'),

  body('instructions')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Instructions must not exceed 1000 characters'),

  handleValidationErrors,
];

export const validateAdmit = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ER visit ID'),

  body('ward')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Ward must not exceed 100 characters'),

  body('bed')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Bed must not exceed 50 characters'),

  handleValidationErrors,
];

export const validateTransfer = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ER visit ID'),

  body('facility')
    .notEmpty()
    .withMessage('Facility is required')
    .isLength({ max: 200 })
    .withMessage('Facility must not exceed 200 characters'),

  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),

  handleValidationErrors,
];
