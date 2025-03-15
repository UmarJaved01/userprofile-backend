const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  console.log('Received token:', token); // Debug log
  if (!token) {
    console.log('No token provided in Authorization header');
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded); // Debug log
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message); // Debug log
    res.status(401).json({ msg: 'Token is not valid', error: err.message });
  }
};

module.exports = authMiddleware;