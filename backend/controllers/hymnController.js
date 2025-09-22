const Hymn = require('../models/Hymn');
const Category = require('../models/Category');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { uploadFile, getSignedUrl, deleteFile } = require('../utils/b2');

// Language mapping for response formatting
const reverseLanguageMap = {
  'am': 'Amharic',
  'om': 'Afan Oromo',
  'ti': 'Tigrigna',
  'en': 'English'
};

// Create hymn (admin only) with file upload to Backblaze B2
exports.createHymn = async (req, res) => {
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
    
    const lang = req.body.lang;
    if (!lang || !['am', 'om', 'ti', 'en'].includes(lang)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid language code'
      });
    }
    
    const fileName = `hymn-${Date.now()}-${req.file.originalname}`;
    const b2FilePath = await uploadFile(req.file.buffer, fileName, 'audio');
    
    const hymnData = {
      ...req.body,
      lang,
      audioUrl: b2FilePath,
      category: req.body.category
    };
    
    console.log('Creating hymn with data:', hymnData);
    
    const hymn = await Hymn.create(hymnData);
    console.log('Hymn created successfully:', hymn._id);
    
    const users = await User.find({ isActive: true });
    console.log('Found users for notifications:', users.length);
    const notifications = users.map(user => ({
      userId: user._id,
      message: `New hymn added: ${hymn.title}`,
      type: 'new_hymn',
      relatedId: hymn._id,
      onModel: 'Hymn',
      isRead: false
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log('Notifications created for', notifications.length, 'users');
    } else {
      console.log('No active users found, no notifications created');
    }
    
    const hymnResponse = {
      ...hymn._doc,
      language: reverseLanguageMap[hymn.lang] || hymn.lang,
      audioUrl: await getSignedUrl(b2FilePath)
    };
    
    res.status(201).json({
      status: 'success',
      data: {
        hymn: hymnResponse
      }
    });
  } catch (error) {
    console.error('Error creating hymn:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error creating hymn: ' + error.message
    });
  }
};

// Get all hymns
exports.getHymns = async (req, res) => {
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
      const aggregateQuery = [{ $match: filter }, { $sample: { size: parseInt(limit) || 10 } }];
      hymns = await Hymn.aggregate(aggregateQuery);
      total = await Hymn.countDocuments(filter);
      hymns = await Hymn.populate(hymns, { path: 'category', select: 'name' });
    } else {
      let query = Hymn.find(filter).populate('category', 'name');
      
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
      total = await Hymn.countDocuments(filter);
    }
    
    // Generate signed URLs for private files
    hymns = await Promise.all(hymns.map(async hymn => ({
      ...hymn._doc || hymn,
      language: reverseLanguageMap[hymn.lang] || hymn.lang,
      audioUrl: await getSignedUrl(hymn.audioUrl)
    })));
    
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
    console.error('Error fetching hymns:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching hymns: ' + error.message
    });
  }
};

// Get single hymn
exports.getHymn = async (req, res) => {
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
    
    const hymnResponse = {
      ...hymn._doc,
      language: reverseLanguageMap[hymn.lang] || hymn.lang,
      audioUrl: await getSignedUrl(hymn.audioUrl)
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn: hymnResponse
      }
    });
  } catch (error) {
    console.error('Error fetching hymn:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching hymn: ' + error.message
    });
  }
};

// Update hymn (admin only)
exports.updateHymn = async (req, res) => {
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
        try {
          await deleteFile(hymn.audioUrl);
          console.log('Deleted old audio file:', hymn.audioUrl);
        } catch (deleteError) {
          console.warn('Could not delete old audio file:', deleteError.message);
        }
      }
      
      const fileName = `hymn-${Date.now()}-${req.file.originalname}`;
      updateData.audioUrl = await uploadFile(req.file.buffer, fileName, 'audio');
    }
    
    const updatedHymn = await Hymn.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name description');
    
    const hymnResponse = {
      ...updatedHymn._doc,
      language: reverseLanguageMap[updatedHymn.lang] || updatedHymn.lang,
      audioUrl: await getSignedUrl(updatedHymn.audioUrl)
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn: hymnResponse
      }
    });
  } catch (error) {
    console.error('Error updating hymn:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error updating hymn: ' + error.message
    });
  }
};

// Delete hymn (admin only)
exports.deleteHymn = async (req, res) => {
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
    
    if (hymn.audioUrl) {
      try {
        await deleteFile(hymn.audioUrl);
        console.log('Deleted audio file from B2:', hymn.audioUrl);
      } catch (deleteError) {
        console.warn('Could not delete audio file from B2:', deleteError.message);
      }
    }
    
    await Hymn.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      status: 'success',
      message: 'Hymn deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting hymn:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting hymn: ' + error.message
    });
  }
};

// Increment download count
exports.incrementDownload = async (req, res) => {
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
    console.error('Error updating download count:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error updating download count: ' + error.message
    });
  }
};