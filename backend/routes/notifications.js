const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Notification.countDocuments({ userId: req.user.id });
    
    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: {
        notifications,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching notifications'
    });
  }
});

// Mark notification as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        notification
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating notification'
    });
  }
});

// Mark all notifications as read
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating notifications'
    });
  }
});

// Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        count
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching unread count'
    });
  }
});

module.exports = router;