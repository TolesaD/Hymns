const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory store for active sessions (for server restart detection)
const activeSessions = new Set();

const auth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.session && req.session.token) {
      token = req.session.token;
    }
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, no token'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_key');
    
    // Check if this session was invalidated by server restart
    if (!activeSessions.has(token)) {
      return res.status(401).json({
        status: 'error',
        message: 'Session expired. Please login again.'
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
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Not authorized, token failed'
    });
  }
};

// Add token to active sessions
auth.addSession = (token) => {
  activeSessions.add(token);
};

// Remove token from active sessions (logout)
auth.removeSession = (token) => {
  activeSessions.delete(token);
};

// Clear all sessions (server restart)
auth.clearAllSessions = () => {
  activeSessions.clear();
};

module.exports = auth;