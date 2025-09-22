const jwt = require('jsonwebtoken');
const User = require('../models/User');

const activeSessions = new Set();

const auth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.session.token) {
      token = req.session.token;
    }

    console.log('Token received:', token);
    console.log('JWT_SECRET:', process.env.JWT_SECRET);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, no token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_key');
    console.log('Token decoded:', decoded);

    if (!activeSessions.has(token)) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, session expired or invalid'
      });
    }

    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, user not found or inactive'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message, error.stack);
    res.status(401).json({
      status: 'error',
      message: 'Not authorized, token failed'
    });
  }
};

const addSession = (token) => {
  console.log('Adding session:', token);
  activeSessions.add(token);
};

const removeSession = (token) => {
  console.log('Removing session:', token);
  activeSessions.delete(token);
};

const clearAllSessions = () => {
  console.log('All active sessions cleared. Users will need to login again.');
  activeSessions.clear();
};

clearAllSessions();

module.exports = { auth, addSession, removeSession, clearAllSessions };