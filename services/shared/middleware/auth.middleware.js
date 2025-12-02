import jwt from 'jsonwebtoken';

import AppError from '../utils/AppError.util.js';
import { asyncHandler } from './asyncHandler.middleware.js';

export const authenticate = asyncHandler(async (req, _, next) => {
  try {
    console.log('🔐 AUTHENTICATE MIDDLEWARE - START');
    console.log('   Current time:', new Date().toISOString());

    let token = null;

    if (req.cookies?.jwt) {
      token = req.cookies.jwt;
      console.log('   Token from cookie:', token ? 'Present' : 'Missing');
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('   Token from header:', token ? 'Present' : 'Missing');
    }

    if (!token) {
      console.log('❌ No token found');
      throw new AppError('Unauthorized. Token is missing.', 401);
    }

    console.log(
      '   Token received (first 50 chars):',
      token.substring(0, 50) + '...'
    );

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    console.log('🚨 AUTHENTICATION ERROR:');
    console.log('   Error name:', error.name);
    console.log('   Error message:', error.message);
    console.log('   Expired at:', error.expiredAt);
    console.log('   Current time:', new Date().toISOString());

    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired. Please login again.', 401);
    } else if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token.', 403);
    } else {
      throw new AppError('Authentication failed.', 403);
    }
  }
});

export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        throw new AppError('User not found.', 403);
      }

      const isAuthorizedRole = allowedRoles.some(
        role => role.toLowerCase() === userRole.toLowerCase()
      );

      if (!isAuthorizedRole) {
        throw new AppError('Access denied.', 403);
      }

      next();
    } catch (error) {
      throw error;
    }
  };
};

export const protectInternalApi = asyncHandler((req, res, next) => {
  const providedKey = req.headers['x-internal-api-key'];

  if (!providedKey || providedKey !== process.env.INTERNAL_API_KEY) {
    throw new AppError(
      'Forbidden: You are not authorized to access this resource',
      403
    );
  }

  next();
});
