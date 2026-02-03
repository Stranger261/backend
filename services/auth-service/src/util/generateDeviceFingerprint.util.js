import crypto from 'crypto';
export const generateDeviceFingerprint = (userAgent, ipAddress) => {
  const data = `${userAgent}-${ipAddress}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};
