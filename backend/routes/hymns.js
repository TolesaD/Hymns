const express = require('express');
const mongoose = require('mongoose');
const Hymn = require('../models/Hymn');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const { uploadAudio, handleUploadError } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Fallback model registration
let HymnModel = Hymn;
if (!Hymn || typeof Hymn.create !== 'function') {
  console.error('Hymn model import failed, re-registering');
  const hymnSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    lyrics: { type: String, required: true },
    audioUrl: { type: String, required: true },
    lang: { type: String, required: true, enum: ['am', 'om', 'ti', 'en'] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    downloads: { type: Number, default: 0 },
    listens: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  }, { timestamps: true });
  hymnSchema.index({ title: 'text', description: 'text', lyrics: 'text' });
  hymnSchema.index({ category: 1 });
  hymnSchema.index({ lang: 1 });
  hymnSchema.index({ isActive: 1 });
  HymnModel = mongoose.model('Hymn', hymnSchema);
}

// Log model import for debugging
console.log('Hymn model imported:', typeof HymnModel, HymnModel ? HymnModel.name : 'undefined');

// Language mapping for response formatting
const reverseLanguageMap = {
  'am': 'Amharic',
  'om': 'Afan Oromo',
  'ti': 'Tigrigna',
  'en': 'English'
};

// Get all hymns with random sorting option
router.get('/', async (req, res) => {
  try {
    const { category, lang, search, page = 1, limit = 10, sort, random } = req.query;
    
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
    
    let hymns;
    let total;

    if (random) {
      // Use aggregation for random sampling
      const aggregateQuery = [{ $match: filter }, { $sample: { size: parseInt(limit) || 10 } }];
      hymns = await HymnModel.aggregate(aggregateQuery);
      total = await HymnModel.countDocuments(filter);
      // Populate category manually for aggregation results
      hymns = await HymnModel.populate(hymns, { path: 'category', select: 'name' });
    } else {
      let query = HymnModel.find(filter).populate('category', 'name');
      
      if (sort) {
        const sortOrder = sort.startsWith('-') ? -1 : 1;
        const sortField = sort.replace('-', '');
        query = query.sort({ [sortField]: sortOrder });
      } else {
        query = query.sort({ createdAt: -1 });
      }
      
      query = query
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      hymns = await query.exec();
      total = await HymnModel.countDocuments(filter);
    }
    
    hymns = hymns.map(hymn => ({
      ...hymn._doc || hymn, // Handle both query and aggregation results
      language: reverseLanguageMap[hymn.lang] || hymn.lang
    }));
    
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
      message: 'Error fetching hymns: ' + error.message
    });
  }
});

// Get single hymn
router.get('/:id', async (req, res) => {
  try {
    const hymn = await HymnModel.findById(req.params.id)
      .populate('category', 'name description');
    
    if (!hymn || !hymn.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    hymn.listens += 1;
    await hymn.save();
    
    const hymnResponse = {
      ...hymn._doc,
      language: reverseLanguageMap[hymn.lang] || hymn.lang
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn: hymnResponse
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
    
    const lang = req.body.lang;
    if (!lang || !['am', 'om', 'ti', 'en'].includes(lang)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid language code'
      });
    }
    
    const hymnData = {
      ...req.body,
      lang,
      audioUrl,
      category: req.body.category
    };
    
    console.log('Creating hymn with data:', hymnData);
    console.log('Hymn model in POST:', typeof HymnModel, HymnModel ? HymnModel.name : 'undefined');
    
    const hymn = await HymnModel.create(hymnData);
    
    const hymnResponse = {
      ...hymn._doc,
      language: reverseLanguageMap[hymn.lang] || hymn.lang
    };
    
    res.status(201).json({
      status: 'success',
      data: {
        hymn: hymnResponse
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
    
    const hymn = await HymnModel.findById(req.params.id);
    
    if (!hymn) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    const updateData = { ...req.body };
    
    if (req.body.lang) {
      if (!['am', 'om', 'ti', 'en'].includes(req.body.lang)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid language code'
        });
      }
      updateData.lang = req.body.lang;
    }
    
    if (req.file) {
      if (hymn.audioUrl) {
        const oldFilePath = path.join(__dirname, '../Uploads/audio', path.basename(hymn.audioUrl));
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      updateData.audioUrl = `/uploads/audio/${req.file.filename}`;
    }
    
    const updatedHymn = await HymnModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name description');
    
    const hymnResponse = {
      ...updatedHymn._doc,
      language: reverseLanguageMap[updatedHymn.lang] || updatedHymn.lang
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn: hymnResponse
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
    
    const hymn = await HymnModel.findById(req.params.id);
    
    if (!hymn) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    if (hymn.audioUrl) {
      const filePath = path.join(__dirname, '../Uploads/audio', path.basename(hymn.audioUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await HymnModel.findByIdAndDelete(req.params.id);
    
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
    const hymn = await HymnModel.findById(req.params.id);
    
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