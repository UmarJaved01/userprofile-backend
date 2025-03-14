const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const redis = require('../redis');

const generateAccessToken = (user) => {
  return jwt.sign({ user: { id: user._id } }, process.env.JWT_SECRET, { expiresIn: '30s' });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ user: { id: user._id } }, process.env.REFRESH_SECRET, { expiresIn: '7d' });
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
    console.log('Login request body:', req.body);
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in Redis as part of a list
    const redisKey = `refresh_tokens_${user._id}`;
    await redis.lpush(redisKey, refreshToken); // Add token to list
    await redis.expire(redisKey, 7 * 24 * 60 * 60); // Set TTL for the list

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.json({ accessToken });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ msg: 'No refresh token' });

  try {
    console.log('Refresh attempt with token:', refreshToken);
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const userId = decoded.user.id;
    console.log('Decoded user ID:', userId);

    // Check if the refresh token exists in the Redis list
    const redisKey = `refresh_tokens_${userId}`;
    const storedTokens = await redis.lrange(redisKey, 0, -1); // Get all tokens in the list
    console.log('Stored tokens from Redis:', storedTokens);

    if (!storedTokens.includes(refreshToken)) {
      console.error('Refresh token not found in Redis:', { refreshToken, storedTokens });
      return res.status(401).json({ msg: 'Invalid refresh token (Redis mismatch)' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ msg: 'Invalid refresh token' });

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(401).json({ msg: 'Invalid refresh token' });
  }
});

// Add a logout route to invalidate the refresh token
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(400).json({ msg: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const userId = decoded.user.id;

    // Remove the specific refresh token from Redis
    const redisKey = `refresh_tokens_${userId}`;
    await redis.lrem(redisKey, 0, refreshToken); // Remove the token from the list

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;