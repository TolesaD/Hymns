const express = require('express');
const Hymn = require('../models/Hymn');
const Comment = require('../models/Comment');
const router = express.Router();

// Hymn detail page
router.get('/:id', async (req, res) => {
  try {
    const hymn = await Hymn.findById(req.params.id);
    if (!hymn) {
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
    
    // Get related hymns
    const relatedHymns = await Hymn.find({
      hymnLanguage: hymn.hymnLanguage,
      category: hymn.category,
      _id: { $ne: hymn._id }
    }).limit(4);
    
    res.render('hymn-detail', {
      title: hymn.title,
      hymn,
      comments,
      relatedHymns,
      user: req.user,
      currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error loading hymn');
    res.redirect('/');
  }
});

// Add comment (not approved yet)
router.post('/:id/comments', async (req, res) => {
  if (!req.user) {
    req.flash('error_msg', 'Please log in to comment');
    return res.redirect(`/hymns/${req.params.id}`);
  }
  
  try {
    const { content, rating } = req.body;
    const hymn = await Hymn.findById(req.params.id);
    
    if (!hymn) {
      req.flash('error_msg', 'Hymn not found');
      return res.redirect('/');
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      req.flash('error_msg', 'Comment content cannot be empty');
      return res.redirect(`/hymns/${req.params.id}`);
    }

    // Check if user has already commented on this hymn
    const existingComment = await Comment.findOne({
      hymn: hymn._id,
      user: req.user.id
    });

    if (existingComment) {
      req.flash('error_msg', 'You have already submitted a comment for this hymn');
      return res.redirect(`/hymns/${req.params.id}`);
    }
    
    const comment = new Comment({
      hymn: hymn._id,
      user: req.user.id,
      content: content.trim(),
      rating: parseInt(rating) || null
    });
    
    await comment.save();
    
    console.log('✅ Comment submitted by user:', req.user.username, 'for hymn:', hymn.title);
    req.flash('success_msg', 'Thank you for your comment! It will be visible after admin approval.');
    res.redirect(`/hymns/${req.params.id}`);
  } catch (error) {
    console.error('Error submitting comment:', error);
    req.flash('error_msg', 'Error submitting comment. Please try again.');
    res.redirect(`/hymns/${req.params.id}`);
  }
});

// Download hymn
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
    
    console.log('📥 Hymn downloaded:', hymn.title, 'by user:', req.user ? req.user.username : 'Anonymous');
    
    // Redirect to audio file
    res.redirect(hymn.audioFile);
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error downloading hymn');
    res.redirect('/');
  }
});

module.exports = router;