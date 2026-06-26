const jwt = require('jsonwebtoken');

// Simple secure login using credentials from environmental config (.env)
const login = (req, res) => {
  try {
    const { username, password } = req.body;

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === adminUser && password === adminPass) {
      // Create JWT token
      const token = jwt.sign(
        { role: 'admin', username },
        process.env.JWT_SECRET || 'supersecretqmskey123',
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Middleware to protect admin routes
const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token missing'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretqmskey123');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid token'
    });
  }
};

module.exports = {
  login,
  protect
};
