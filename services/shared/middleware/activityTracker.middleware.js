import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { asyncHandler } from './asyncHandler.middleware.js';

import { UserSession } from '../models/index.js';

export const trackActivity = asyncHandler(async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find the session
    const session = await UserSession.findOne({
      where: {
        user_id: decoded.user_id,
        token_hash: tokenHash,
        revoked: false,
      },
    });

    if (!session) {
      return res.status(401).json({ message: 'Session not found.' });
    }

    // Check inactivity (30 minutes)
    const inactivityLimit = 30 * 60 * 1000; // 30 minutes in ms
    const now = new Date();
    const lastActivity = new Date(session.last_activity);

    if (now - lastActivity > inactivityLimit) {
      // Session expired due to inactivity
      session.revoked = true;
      session.revoked_at = now;
      await session.save();

      res.clearCookie('jwt');
      return res.status(401).json({
        message: 'Session expired due to inactivity.',
        code: 'INACTIVITY_TIMEOUT',
      });
    }

    // Update last activity
    session.last_activity = now;
    await session.save();

    req.user = decoded;
    next();
  } catch (error) {
    next();
  }
});
