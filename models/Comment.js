const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  hymn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hymn',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    trim: true
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    required: [true, 'Rating is required']
  },
  approved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate comments from same user on same hymn
commentSchema.index({ hymn: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Comment', commentSchema);