const Hymn = require('../models/Hymn');
const Category = require('../models/Category');

// Get all hymns
exports.getHymns = async (req, res) => {
  try {
    const { category, language, search, page = 1, limit = 10 } = req.query;
    
    let filter = { isActive: true };
    
    if (category) {
      const categoryDoc = await Category.findOne({ name: category, isActive: true });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }
    
    if (language) {
      filter.language = language;
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
    res.status(500).json({
      status: 'error',
      message: 'Error fetching hymns'
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
    
    // Increment listen count
    hymn.listens += 1;
    await hymn.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching hymn'
    });
  }
};

// Create hymn
exports.createHymn = async (req, res) => {
  try {
    const hymn = await Hymn.create(req.body);
    
    res.status(201).json({
      status: 'success',
      data: {
        hymn
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating hymn'
    });
  }
};

// Update hymn
exports.updateHymn = async (req, res) => {
  try {
    const hymn = await Hymn.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!hymn) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        hymn
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error updating hymn'
    });
  }
};

// Delete hymn
exports.deleteHymn = async (req, res) => {
  try {
    const hymn = await Hymn.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!hymn) {
      return res.status(404).json({
        status: 'error',
        message: 'Hymn not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Hymn deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error deleting hymn'
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
    res.status(500).json({
      status: 'error',
      message: 'Error updating download count'
    });
  }
};