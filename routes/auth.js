const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const redis = require('../redis');

const generateAccessToken = (user) => {
  return jwt.sign({ user: { id: user._id } }, process.env.JWT_SECRET, { expiresIn: '15s' });
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
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body; // identifier can be email or username
  try {
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });
    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ msg: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) return res.status(401).json({ msg: 'Invalid refresh token' });

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ msg: 'Invalid refresh token' });
  }
});

module.exports = router;