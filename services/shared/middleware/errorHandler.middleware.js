// src/middleware/errorHandler.js
import AppError from '../utils/AppError.util.js';

const errorHandler = (error, req, res, next) => {
  // ADD THESE DEBUG LOGS
  console.error('🚨 ERROR CAUGHT:', {
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    isAppError: error instanceof AppError,
  });

  // Handle AppError instances FIRST
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.name,
      message: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // Sequelize Validation Error
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: error.errors.map(err => err.message).join(', '),
      details: error.errors,
    });
  }

  // Sequelize Unique Constraint Error
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate Entry',
      message: 'A record with this information already exists',
      field: error.errors[0]?.path,
    });
  }

  // Sequelize Database Error
  if (error.name === 'SequelizeDatabaseError') {
    return res.status(400).json({
      success: false,
      error: 'Database Error',
      message: 'There was an issue with the database operation',
    });
  }

  // Multer Errors
  if (error.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: 'File Upload Error',
      message: error.message,
      ...(error.field && { field: error.field }),
    });
  }

  // JWT Errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid Token',
      message: 'Authentication token is invalid',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token Expired',
      message: 'Authentication token has expired',
    });
  }

  // Axios Errors
  if (error.isAxiosError) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'External service error';
    return res.status(status).json({
      success: false,
      error: 'Service Error',
      message,
    });
  }

  // Default: Unhandled errors
  console.error('⚠️ UNHANDLED ERROR:', error);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

export default errorHandler;
