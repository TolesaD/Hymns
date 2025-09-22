const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'jwt_secret_key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error', 
        message: errors.array()[0].msg 
      });
    }

    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'User already exists with this email or username' 
      });
    }

    // Create user
    const newUser = await User.create({
      username,
      email,
      password,
      role: (email === 'tolesadebushe9@gmail.com') ? 'admin' : 'user'
    });

    const token = signToken(newUser._id);

    // Add to active sessions
    auth.addSession(token);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      token,
      data: {
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message, error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Server error during registration'
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error', 
        message: errors.array()[0].msg 
      });
    }

    const { email, password } = req.body;

    // Check if user exists and password is correct
    const user = await User.findOne({ email, isActive: true }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }

    // Check password
    const isPasswordCorrect = await user.correctPassword(password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }

    const token = signToken(user._id);
    
    // Add to active sessions
    auth.addSession(token);
    
    // Store token in session
    req.session.token = token;
    req.session.userId = user._id;

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Server error during login'
    });
  }
};

// Logout user
exports.logout = (req, res) => {
  try {
    const token = req.session.token || 
                 (req.headers.authorization && req.headers.authorization.startsWith('Bearer') 
                  ? req.headers.authorization.split(' ')[1] 
                  : null);
    
    if (token) {
      // Remove from active sessions
      auth.removeSession(token);
    }
    
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          status: 'error',
          message: 'Error during logout'
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('Logout error:', error.message, error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Server error during logout'
    });
  }
};

// Check authentication status
exports.checkAuth = async (req, res) => {
  try {
    const token = req.session.token || 
                 (req.headers.authorization && req.headers.authorization.startsWith('Bearer') 
                  ? req.headers.authorization.split(' ')[1] 
                  : null);
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_key');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Check auth error:', error.message, error.stack);
    res.status(401).json({
      status: 'error',
      message: 'Not authenticated'
    });
  }
};

// Forgot password - send reset email
exports.forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error', 
        message: errors.array()[0].msg 
      });
    }

    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email, isActive: true });
    
    if (!user) {
      return res.status(200).json({
        status: 'success',
        message: 'If the email exists, a password reset link has been logged to the server terminal.'
      });
    }
    
    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    
    // Log the reset link for testing (since no external email)
    const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/reset-password.html?token=${resetToken}`;
    console.log('Password reset link (for testing):', resetURL);
    
    res.status(200).json({
      status: 'success',
      message: 'Password reset link has been logged to the server terminal for testing.'
    });
  } catch (error) {
    console.error('Forgot password error:', error.message, error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Error processing request'
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error', 
        message: errors.array()[0].msg 
      });
    }

    const { token, password } = req.body;
    
    // Hash the token to compare with stored token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is invalid or has expired'
      });
    }
    
    // Update password and clear reset token
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error.message, error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Error resetting password'
    });
  }
};

// Verify reset token
exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is invalid or has expired'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Token is valid'
    });
  } catch (error) {
    console.error('Verify token error:', error.message, error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Error verifying token'
    });
  }
};