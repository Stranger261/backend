import Joi from 'joi';

const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string()
      .valid(
        'patient',
        'doctor',
        'nurse',
        'receptionist',
        'admin',
        'super_admin'
      )
      .default('patient'),
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  verifyOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
  }),

  resendOtp: Joi.object({
    email: Joi.string().email().required(),
  }),

  updateProfile: Joi.object({
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    // Add other profile fields as needed
  }),
};

export const validateMiddleware = schemaName => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    next();
  };
};
