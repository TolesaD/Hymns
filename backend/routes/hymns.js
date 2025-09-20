const express = require('express');
const Hymn = require('../models/Hymn');
const Category = require('../models/Category');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { uploadAudio, handleUploadError } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const router = express.Router();

// Get all hymns
router.get('/', async (req, res) => {
  try {
    const { category, lang, search, page = 1, limit = 10 } = req.query;
    
    let filter = { isActive: true };
    
    if (category) {
      const categoryDoc = await Category.findOne({ name: category, isActive: true });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }
    
    if (lang) {
      filter.lang = lang;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { lyrics: { $regex: search, $options: 'i' } }
      ];
    }
    
    const hymns = await Hymn.find(filter)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Hymn.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: hymns.length,
      data: {
        hymns,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (error) {
    console.error('Error fetching hymns:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching hymns'
    });
  }
});

// Get single hymn
router.get('/:id', async (req, res) => {
  try {
    const hymn = await Hymn.findById(req.params.id)
      .populate('category', 'name description');
    
    if (!hymn || !hymn.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    hymn.listens += 1;
    await hymn.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn
      }
    });
  } catch (error) {
    console.error('Error fetching hymn:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching hymn'
    });
  }
});

// Create hymn (admin only) with file upload
router.post('/', auth, uploadAudio.single('audio'), handleUploadError, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin only.'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Audio file is required'
      });
    }
    
    const audioUrl = `/uploads/audio/${req.file.filename}`;
    
    const hymnData = {
      ...req.body,
      audioUrl: audioUrl,
      category: req.body.category
    };
    
    const hymn = await Hymn.create(hymnData);

    // Send notification emails to all active users
    const users = await User.find({ isActive: true });
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    users.forEach(async (user) => {
      try {
        await transporter.sendMail({
          from: `"Orthodox Hymns" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: 'New Hymn Added to Orthodox Hymns',
          html: `
            <p>Hello ${user.username},</p>
            <p>A new hymn "${hymn.title}" has been added to Orthodox Hymns.</p>
            <p>Check it out at <a href="https://${req.headers.host}/">Orthodox Hymns</a>.</p>
            <p>Orthodox Hymns Team</p>
          `,
        });
      } catch (emailError) {
        console.error(`Error sending email to ${user.email}:`, emailError);
      }
    });

    res.status(201).json({
      status: 'success',
      data: {
        hymn
      }
    });
  } catch (error) {
    console.error('Error creating hymn:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating hymn: ' + error.message
    });
  }
});

// Update hymn (admin only)
router.put('/:id', auth, uploadAudio.single('audio'), handleUploadError, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin only.'
      });
    }
    
    const hymn = await Hymn.findById(req.params.id);
    
    if (!hymn) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    // Prepare update data
    const updateData = { ...req.body };
    
    // If new audio file is uploaded
    if (req.file) {
      // Delete old audio file if it exists
      if (hymn.audioUrl) {
        const oldFilePath = path.join('/tmp', 'Uploads', 'audio', path.basename(hymn.audioUrl));
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      // Set new audio URL
      updateData.audioUrl = `/uploads/audio/${req.file.filename}`;
    }
    
    const updatedHymn = await Hymn.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name description');
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn: updatedHymn
      }
    });
  } catch (error) {
    console.error('Error updating hymn:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating hymn: ' + error.message
    });
  }
});

// Delete hymn (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin only.'
      });
    }
    
    const hymn = await Hymn.findById(req.params.id);
    
    if (!hymn) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    // Delete audio file if it exists
    if (hymn.audioUrl) {
      const filePath = path.join('/tmp', 'Uploads', 'audio', path.basename(hymn.audioUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete from database
    await Hymn.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      status: 'success',
      message: 'Hymn deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting hymn:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting hymn: ' + error.message
    });
  }
});

// Increment download count
router.post('/:id/download', async (req, res) => {
  try {
    const hymn = await Hymn.findById(req.params.id);
    
    if (!hymn || !hymn.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    hymn.downloads += 1;
    await hymn.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Download count updated'
    });
  } catch (error) {
    console.error('Error updating download count:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating download count'
    });
  }
});

module.exports = router;