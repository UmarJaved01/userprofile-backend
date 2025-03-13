const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

// Log when Redis connects
redis.on('connect', () => {
  console.log('Redis connected successfully');
});

// Log any Redis connection errors
redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

// Optional: Test Redis with a simple set/get operation on startup
redis.set('test_key', 'Redis is working', (err, result) => {
  if (err) {
    console.error('Error setting test key:', err.message);
  } else {
    console.log('Test key set:', result);
    redis.get('test_key', (err, value) => {
      if (err) {
        console.error('Error getting test key:', err.message);
      } else {
        console.log('Test key value:', value);
      }
    });
  }
});

module.exports = redis;