import Redis from 'ioredis';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: times => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: process.env.maxRetriesPerRequest || 5,
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected.');
});

redisClient.on('error', err => {
  console.error('❌ Redis failed to connect. Error: ', err.message);
});

redisClient.on('close', () => {
  console.warn('⚠️ Redis connection closed.');
});

export default redisClient;
