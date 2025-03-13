const Redis = require('ioredis');

// Create Redis client using REDIS_URL (required)
const redis = new Redis(process.env.REDIS_URL, {
  connectTimeout: 10000, // 10 seconds timeout
  tls: { servername: process.env.REDIS_URL.split('@')[1].split(':')[0] || 'localhost' }, // Extract host for TLS
});

// Log connection events
redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

// Test Redis connection with a simple set/get operation
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