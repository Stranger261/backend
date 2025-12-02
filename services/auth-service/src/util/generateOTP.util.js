import crypto from 'crypto';

export const otpGenerator = () => crypto.randomInt(100000, 999999).toString();
