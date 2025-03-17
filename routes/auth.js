const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const redis = require('../redis');

const generateAccessToken = (user) => {
  return jwt.sign({ user: { id: user._id } }, process.env.JWT_SECRET, { expiresIn: '30s' });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ user: { id: user._id } }, process.env.REFRESH_SECRET, { expiresIn: '2m' });
};

// Determine cookie settings based on environment
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProduction, // Set to true in production (HTTPS), false in development (HTTP)
  sameSite: isProduction ? 'none' : 'lax', // Use 'none' in production for cross-origin, 'lax' in development
  path: '/',
};

router.post('/signup', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.status(400).json({ msg: 'Passwords do not match' });

  try {
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({ username, email, password });
    await user.save();

    res.json({ msg: 'Signup successful, please login' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const redisKey = `refresh_tokens_${user._id}`;
    await redis.lpush(redisKey, refreshToken);
    await redis.expire(redisKey, 7 * 24 * 60 * 60);

    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.json({ accessToken });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  console.log('Refresh token received:', refreshToken); // Debug log
  if (!refreshToken) {
    console.log('No refresh token provided');
    return res.status(401).json({ msg: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const userId = decoded.user.id;
    console.log('Decoded user ID from refresh token:', userId);

    const redisKey = `refresh_tokens_${userId}`;
    const storedTokens = await redis.lrange(redisKey, 0, -1);
    console.log('Stored tokens in Redis:', storedTokens);

    if (!storedTokens.includes(refreshToken)) {
      console.log('Refresh token not found in Redis:', refreshToken);
      return res.status(401).json({ msg: 'Invalid refresh token (not found in Redis)' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found for ID:', userId);
      return res.status(401).json({ msg: 'User not found' });
    }

    const newAccessToken = generateAccessToken(user);
    console.log('New access token generated:', newAccessToken);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('Refresh token verification failed:', err.message);
    res.status(401).json({ msg: 'Invalid refresh token', error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(400).json({ msg: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const userId = decoded.user.id;

    const redisKey = `refresh_tokens_${userId}`;
    await redis.lrem(redisKey, 0, refreshToken);

    res.clearCookie('refreshToken', cookieOptions);
    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;