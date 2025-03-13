const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Profile = require('../models/Profile');
const redis = require('../redis');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const cacheKey = `profile:${req.user.id}`;
    const cachedProfile = await redis.get(cacheKey);

    if (cachedProfile) {
      return res.json(JSON.parse(cachedProfile));
    }

    const profile = await Profile.findOne({ user: req.user.id });
    if (!profile) return res.status(404).json({ msg: 'Profile not found' });

    await redis.set(cacheKey, JSON.stringify(profile), 'EX', 3600); // Cache for 1 hour
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create Profile (POST)
router.post('/', authMiddleware, async (req, res) => {
  const { name, age, gender } = req.body;
  try {
    let profile = await Profile.findOne({ user: req.user.id });
    if (profile) return res.status(400).json({ msg: 'Profile already exists, use PUT to update' });

    profile = new Profile({ user: req.user.id, name, age, gender });
    await profile.save();

    const cacheKey = `profile:${req.user.id}`;
    await redis.set(cacheKey, JSON.stringify(profile), 'EX', 3600);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Profile (PUT)
router.put('/', authMiddleware, async (req, res) => {
  const { name, age, gender } = req.body;
  try {
    let profile = await Profile.findOne({ user: req.user.id });
    if (!profile) return res.status(404).json({ msg: 'Profile not found' });

    profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { name, age, gender },
      { new: true }
    );

    const cacheKey = `profile:${req.user.id}`;
    await redis.set(cacheKey, JSON.stringify(profile), 'EX', 3600);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete Profile (DELETE)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const profile = await Profile.findOneAndDelete({ user: req.user.id });
    if (!profile) return res.status(404).json({ msg: 'Profile not found' });

    const cacheKey = `profile:${req.user.id}`;
    await redis.del(cacheKey);
    res.json({ msg: 'Profile deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;