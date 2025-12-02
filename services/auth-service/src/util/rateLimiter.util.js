import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  retryStrategy: times => {
    if (times > 3) {
      console.warn('⚠️ Redis not available, rate limiting disabled.');
      return null;
    }
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 5,
});

redis.on('connect', () => {
  console.log('✅ Redis connected for rate limiting.');
});

redis.on('error', err => {
  console.log('❌ Redis error: ', err);
});

const isRedisAvailable = () => redis.status === 'ready';

export const incrWithTTL = async (key, ttlSeconds = 900) => {
  try {
    if (!isRedisAvailable()) {
      console.warn('⚠️ Redis unavailable, skipping rate limiter.');
      return 0;
    }

    const val = await redis.incr(key);
    if (val === 1) {
      await redis.expire(key, ttlSeconds);
    }

    return val;
  } catch (error) {
    console.log('❌ Redis incr error: ', error.message);
    return 0;
  }
};

export const getVal = async key => {
  try {
    if (!isRedisAvailable()) {
      const v = await redis.get(key);

      return v ? Number(v) : 0;
    }
  } catch (error) {
    console.log('❌ Redis get error: ', error.message);
    return 0;
  }
};

export const resetKey = async key => {
  try {
    if (!isRedisAvailable()) return;

    await redis.del(key);
  } catch (error) {
    console.error('❌ Redis del error: ', error.message);
  }
};

export default redis;
