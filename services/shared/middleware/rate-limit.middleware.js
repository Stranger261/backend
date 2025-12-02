const rateLimitStore = new Map();

export const rateLimitMiddleware = (req, res, next) => {
  const ip = req.ipAddress || req.ip;
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 10;

  const now = Date.now();
  const windowsStart = now - windowMs;

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }

  const requests = rateLimitStore.get(ip).filter((time = time > windowsStart));

  if (requests.length >= maxRequests) {
    return res.json(429).json({
      success: false,
      error: 'Too many requests, please try again later',
    });
  }

  requests.push(now);
  rateLimitStore.set(ip, requests);

  next();
};
