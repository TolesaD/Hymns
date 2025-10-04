const express = require('express');
const Hymn = require('../models/Hymn');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const router = express.Router();

// Hymn detail page - FIXED: Remove duplicate flash message passing
router.get('/:id', async (req, res) => {
  try {
    const hymn = await Hymn.findById(req.params.id);
    if (!hymn) {
      console.log('❌ Hymn not found:', req.params.id);
      req.flash('error_msg', 'Hymn not found');
      return res.redirect('/');
    }
    
    // Increment play count
    hymn.plays += 1;
    await hymn.save();
    
    // Get approved comments only
    const comments = await Comment.find({ hymn: hymn._id, approved: true })
      .populate('user', 'username')
      .sort({ createdAt: -1 });
    
    // Check if current user has already commented
    let userComment = null;
    if (req.user) {
      userComment = await Comment.findOne({
        hymn: hymn._id,
        user: req.user.id
      });
    }
    
    // Get related hymns
    const relatedHymns = await Hymn.find({
      hymnLanguage: hymn.hymnLanguage,
      category: hymn.category,
      _id: { $ne: hymn._id }
    }).limit(4);
    
    console.log('🎵 Hymn detail loaded:', hymn.title, 'Comments:', comments.length, 'User comment exists:', !!userComment);
    
    res.render('hymn-detail', {
      title: hymn.title,
      hymn,
      comments,
      relatedHymns,
      userComment,
      user: req.user,
      currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl
    });
  } catch (error) {
    console.error('❌ Hymn detail error:', error);
    req.flash('error_msg', 'Error loading hymn details');
    res.redirect('/');
  }
});

// Add comment (not approved yet) - ENHANCED WITH COMPREHENSIVE VALIDATION
router.post('/:id/comments', async (req, res) => {
  if (!req.user) {
    console.log('❌ Comment attempt without login');
    req.flash('error_msg', 'Please log in to rate and comment on hymns');
    return res.redirect(`/hymns/${req.params.id}`);
  }
  
  try {
    const { content, rating } = req.body;
    const hymn = await Hymn.findById(req.params.id);
    
    if (!hymn) {
      console.log('❌ Hymn not found for comment:', req.params.id);
      req.flash('error_msg', 'Hymn not found');
      return res.redirect('/');
    }

    // COMPREHENSIVE RATING VALIDATION
    if (!rating || rating === '0' || rating === '') {
      console.log('❌ Comment submitted without rating by:', req.user.username);
      req.flash('error_msg', '⭐ Please rate the hymn (1-5 stars) before submitting your comment');
      return res.redirect(`/hymns/${req.params.id}#comment-form`);
    }

    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      console.log('❌ Invalid rating value:', rating, 'by user:', req.user.username);
      req.flash('error_msg', 'Please provide a valid rating between 1 and 5 stars');
      return res.redirect(`/hymns/${req.params.id}#comment-form`);
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      console.log('❌ Empty comment submitted by:', req.user.username);
      req.flash('error_msg', '📝 Please write a comment before submitting');
      return res.redirect(`/hymns/${req.params.id}#comment-form`);
    }

    if (content.trim().length < 2) {
      console.log('❌ Comment too short by:', req.user.username);
      req.flash('error_msg', 'Comment must be at least 2 characters long');
      return res.redirect(`/hymns/${req.params.id}#comment-form`);
    }

    if (content.trim().length > 1000) {
      console.log('❌ Comment too long by:', req.user.username);
      req.flash('error_msg', 'Comment cannot exceed 1000 characters');
      return res.redirect(`/hymns/${req.params.id}#comment-form`);
    }

    // Check if user has already commented on this hymn
    const existingComment = await Comment.findOne({
      hymn: hymn._id,
      user: req.user.id
    });

    if (existingComment) {
      console.log('❌ Duplicate comment attempt by:', req.user.username, 'for hymn:', hymn.title);
      
      if (existingComment.approved) {
        req.flash('info_msg', 'You have already submitted a comment for this hymn. Your previous comment is visible below.');
      } else {
        req.flash('warning_msg', 'You have already submitted a comment for this hymn. It is pending admin approval.');
      }
      return res.redirect(`/hymns/${req.params.id}#comments`);
    }
    
    // Create new comment
    const comment = new Comment({
      hymn: hymn._id,
      user: req.user.id,
      content: content.trim(),
      rating: numericRating,
      approved: false
    });
    
    await comment.save();
    
    console.log('✅ Comment submitted by user:', req.user.username, 
                'for hymn:', hymn.title, 
                'Rating:', numericRating, 
                'Content length:', content.trim().length);
    
    // SUCCESS: Comment submitted for approval - ENHANCED MESSAGE
    req.flash('success_msg', 
      `⭐ Thank you for your ${numericRating}-star rating and comment! ` +
      `Your feedback has been submitted for admin approval and will be visible soon.`
    );
    
    // Send notification to admin about pending comment
    try {
      const adminUser = await require('../models/User').findOne({ 
        username: 'Tolesa',
        email: 'marosetofficial@gmail.com'
      });
      
      if (adminUser) {
        await Notification.create({
          user: adminUser._id,
          title: '💬 New Comment Pending Review',
          message: `User ${req.user.username} submitted a comment on "${hymn.title}" that needs approval`,
          type: 'info',
          priority: 'medium',
          read: false
        });
        console.log('📢 Admin notified about pending comment');
      }
    } catch (notifyError) {
      console.error('❌ Error notifying admin:', notifyError);
    }
    
    return res.redirect(`/hymns/${req.params.id}#comments`);
    
  } catch (error) {
    console.error('❌ Error submitting comment:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      req.flash('error_msg', `Validation error: ${messages.join(', ')}`);
    } else if (error.code === 11000) {
      req.flash('error_msg', 'You have already submitted a comment for this hymn');
    } else {
      req.flash('error_msg', 'Error submitting comment. Please try again.');
    }
    
    return res.redirect(`/hymns/${req.params.id}#comment-form`);
  }
});

// Update comment (if user wants to edit their pending comment)
router.post('/:id/comments/:commentId/edit', async (req, res) => {
  if (!req.user) {
    req.flash('error_msg', 'Please log in to edit your comment');
    return res.redirect(`/hymns/${req.params.id}`);
  }
  
  try {
    const { content, rating } = req.body;
    const hymn = await Hymn.findById(req.params.id);
    const comment = await Comment.findOne({
      _id: req.params.commentId,
      user: req.user.id,
      hymn: req.params.id
    });
    
    if (!comment) {
      req.flash('error_msg', 'Comment not found or you do not have permission to edit it');
      return res.redirect(`/hymns/${req.params.id}`);
    }
    
    // Only allow editing if not approved yet
    if (comment.approved) {
      req.flash('info_msg', 'Cannot edit approved comments. Please contact admin if you need changes.');
      return res.redirect(`/hymns/${req.params.id}`);
    }
    
    // Validate rating
    if (rating) {
      const numericRating = parseInt(rating);
      if (numericRating >= 1 && numericRating <= 5) {
        comment.rating = numericRating;
      }
    }
    
    // Validate content
    if (content && content.trim().length >= 2 && content.trim().length <= 1000) {
      comment.content = content.trim();
    } else if (content) {
      req.flash('error_msg', 'Comment must be between 2 and 1000 characters');
      return res.redirect(`/hymns/${req.params.id}`);
    }
    
    await comment.save();
    
    console.log('✏️ Comment updated by user:', req.user.username, 'for hymn:', hymn.title);
    req.flash('success_msg', 'Comment updated successfully! It will be visible after admin approval.');
    
    return res.redirect(`/hymns/${req.params.id}#comments`);
    
  } catch (error) {
    console.error('❌ Error updating comment:', error);
    req.flash('error_msg', 'Error updating comment');
    return res.redirect(`/hymns/${req.params.id}`);
  }
});

// Delete user's own comment
router.post('/:id/comments/:commentId/delete', async (req, res) => {
  if (!req.user) {
    req.flash('error_msg', 'Please log in to delete your comment');
    return res.redirect(`/hymns/${req.params.id}`);
  }
  
  try {
    const comment = await Comment.findOne({
      _id: req.params.commentId,
      user: req.user.id,
      hymn: req.params.id
    });
    
    if (!comment) {
      req.flash('error_msg', 'Comment not found or you do not have permission to delete it');
      return res.redirect(`/hymns/${req.params.id}`);
    }
    
    await Comment.findByIdAndDelete(comment._id);
    
    console.log('🗑️ Comment deleted by user:', req.user.username, 'for hymn:', comment.hymn);
    req.flash('success_msg', 'Your comment has been deleted successfully.');
    
    return res.redirect(`/hymns/${req.params.id}#comments`);
    
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    req.flash('error_msg', 'Error deleting comment');
    return res.redirect(`/hymns/${req.params.id}`);
  }
});

// Download hymn - ENHANCED WITH BETTER TRACKING
router.get('/:id/download', async (req, res) => {
  try {
    const hymn = await Hymn.findById(req.params.id);
    if (!hymn) {
      req.flash('error_msg', 'Hymn not found');
      return res.redirect('/');
    }
    
    // Increment download count
    hymn.downloads += 1;
    await hymn.save();
    
    const userName = req.user ? req.user.username : 'Anonymous';
    console.log('📥 Hymn downloaded:', hymn.title, 'by user:', userName, 'Total downloads:', hymn.downloads);
    
    // Show success message if user is logged in
    if (req.user) {
      req.flash('info_msg', `Download started: "${hymn.title}"`);
    }
    
    // Redirect to audio file
    res.redirect(hymn.audioFile);
  } catch (error) {
    console.error('❌ Download error:', error);
    req.flash('error_msg', 'Error downloading hymn');
    res.redirect('/');
  }
});

// Rate hymn without comment (quick rating)
router.post('/:id/rate', async (req, res) => {
  if (!req.user) {
    console.log('❌ Rating attempt without login');
    req.flash('error_msg', 'Please log in to rate hymns');
    return res.redirect(`/hymns/${req.params.id}`);
  }
  
  try {
    const { rating } = req.body;
    const hymn = await Hymn.findById(req.params.id);
    
    if (!hymn) {
      console.log('❌ Hymn not found for rating:', req.params.id);
      req.flash('error_msg', 'Hymn not found');
      return res.redirect('/');
    }

    // Validate rating
    if (!rating || rating === '0') {
      console.log('❌ Empty rating submitted by:', req.user.username);
      req.flash('error_msg', 'Please select a rating between 1 and 5 stars');
      return res.redirect(`/hymns/${req.params.id}`);
    }

    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      console.log('❌ Invalid rating value:', rating, 'by user:', req.user.username);
      req.flash('error_msg', 'Please provide a valid rating between 1 and 5 stars');
      return res.redirect(`/hymns/${req.params.id}`);
    }

    // Check if user has already rated this hymn
    const existingComment = await Comment.findOne({
      hymn: hymn._id,
      user: req.user.id
    });

    if (existingComment) {
      console.log('❌ Duplicate rating attempt by:', req.user.username);
      req.flash('info_msg', 'You have already rated this hymn. You can update your rating by editing your comment.');
      return res.redirect(`/hymns/${req.params.id}#comments`);
    }
    
    // Create rating-only comment (auto-approved for ratings without text)
    const comment = new Comment({
      hymn: hymn._id,
      user: req.user.id,
      content: `⭐ ${numericRating}-star rating`,
      rating: numericRating,
      approved: true
    });
    
    await comment.save();
    
    // Update hymn rating immediately since it's auto-approved
    await updateHymnRating(hymn._id);
    
    console.log('⭐ Quick rating submitted by user:', req.user.username, 
                'for hymn:', hymn.title, 'Rating:', numericRating);
    
    req.flash('success_msg', `Thank you for your ${numericRating}-star rating!`);
    
    return res.redirect(`/hymns/${req.params.id}#comments`);
    
  } catch (error) {
    console.error('❌ Error submitting rating:', error);
    req.flash('error_msg', 'Error submitting rating. Please try again.');
    return res.redirect(`/hymns/${req.params.id}`);
  }
});

// Helper function to update hymn rating
async function updateHymnRating(hymnId) {
  try {
    console.log('📊 Updating hymn rating for:', hymnId);
    
    const result = await Comment.aggregate([
      {
        $match: {
          hymn: require('mongoose').Types.ObjectId(hymnId),
          approved: true,
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$hymn',
          averageRating: { $avg: '$rating' },
          ratingCount: { $sum: 1 }
        }
      }
    ]);

    if (result.length > 0) {
      const newRating = parseFloat(result[0].averageRating.toFixed(1));
      const newRatingCount = result[0].ratingCount;
      
      await Hymn.findByIdAndUpdate(hymnId, {
        rating: newRating,
        ratingCount: newRatingCount
      });
      
      console.log(`✅ Hymn ${hymnId} rating updated: ${newRating} (${newRatingCount} ratings)`);
    } else {
      // No approved ratings, reset to 0
      await Hymn.findByIdAndUpdate(hymnId, {
        rating: 0,
        ratingCount: 0
      });
      console.log(`✅ Hymn ${hymnId} rating reset to 0 (no approved ratings)`);
    }
  } catch (error) {
    console.error('❌ Error updating hymn rating:', error);
    throw error;
  }
}

module.exports = router;