const User = require('../models/User');

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching users'
    });
  }
};

// Delete user (admin only) - FIXED VERSION
exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin only.'
      });
    }
    
    // Check if user is trying to delete themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot delete your own account'
      });
    }
    
    // Use findByIdAndDelete instead of findByIdAndUpdate
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error deleting user: ' + error.message
    });
  }
};

// Add to favorites
exports.addFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.favorites.includes(req.params.hymnId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Hymn already in favorites'
      });
    }
    
    user.favorites.push(req.params.hymnId);
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Added to favorites'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error adding to favorites'
    });
  }
};

// Remove from favorites
exports.removeFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    user.favorites = user.favorites.filter(
      fav => fav.toString() !== req.params.hymnId
    );
    
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Removed from favorites'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error removing from favorites'
    });
  }
};

// Get favorites
exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('favorites')
      .select('favorites');
    
    res.status(200).json({
      status: 'success',
      data: {
        favorites: user.favorites
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching favorites'
    });
  }
};