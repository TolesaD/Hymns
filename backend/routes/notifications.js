const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all notifications for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('relatedId', 'title name');
    
    res.status(200).json({
      status: 'success',
      data: {
        notifications
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching notifications'
    });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }
    
    notification.isRead = true;
    await notification.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error marking notification as read'
    });
  }
});

module.exports = router;