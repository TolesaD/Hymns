const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'jwt_secret_key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// ... existing routes (register, login, logout, check)

// Forgot password - send reset email
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
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
      // Don't reveal whether email exists or not for security
      return res.status(200).json({
        status: 'success',
        message: 'If the email exists, a password reset link has been sent'
      });
    }
    
    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    
    // Send email
    try {
      const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/reset-password.html?token=${resetToken}`;
      
      const transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'tolesadebushe9@gmail.com',
        to: user.email,
        subject: 'Password Reset Request - Orthodox Hymns',
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your Orthodox Hymns account.</p>
          <p>Click the link below to reset your password (valid for 10 minutes):</p>
          <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #3a506b; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
          <p>If you didn't request this reset, please ignore this email.</p>
          <p><strong>Link:</strong> ${resetURL}</p>
        `
      };
      
      await transporter.sendMail(mailOptions);
      
      res.status(200).json({
        status: 'success',
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // Reset the token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      return res.status(500).json({
        status: 'error',
        message: 'Error sending email. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing request'
    });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
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
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error resetting password'
    });
  }
});

// Verify reset token
router.get('/verify-reset-token/:token', async (req, res) => {
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
    console.error('Verify token error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error verifying token'
    });
  }
});

module.exports = router;