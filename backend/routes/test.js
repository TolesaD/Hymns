const express = require('express');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

// Check database connection and users
router.get('/db-status', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    const users = await User.find().select('email username role').lean();
    
    res.status(200).json({
      status: 'success',
      data: {
        database: dbStates[dbState],
        usersCount: users.length,
        users: users
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database error: ' + error.message
    });
  }
});

// Test user creation
router.post('/test-user', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists'
      });
    }
    // Create test user
    const user = await User.create({
      email,
      password,
      username,
      role: 'user'
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Test user created',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating test user: ' + error.message
    });
  }
});

module.exports = router;