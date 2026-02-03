export const attachRequestInfo = (req, res, next) => {
  req.clientInfo = {
    ipAddress:
      req.headers['x-forwarded-for']?.split(',').shift() ||
      req.socket?.remoteAddress ||
      'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    sessionId: req.sessionID || req.session?.id || null,
    timestamp: new Date().toISOString(),
  };

  next();
};
