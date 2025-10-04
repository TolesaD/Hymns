const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  hymn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hymn',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    trim: true,
    validate: {
      validator: function(v) {
        return v.trim().length > 0;
      },
      message: 'Comment cannot be empty or just whitespace'
    }
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    required: [true, 'Rating is required'],
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be a whole number'
    }
  },
  approved: {
    type: Boolean,
    default: false,
    index: true
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  adminNotes: {
    type: String,
    maxlength: [500, 'Admin notes cannot exceed 500 characters'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate comments from same user on same hymn
commentSchema.index({ hymn: 1, user: 1 }, { unique: true });

// Compound index for efficient queries
commentSchema.index({ hymn: 1, approved: 1, createdAt: -1 });
commentSchema.index({ user: 1, createdAt: -1 });

// Pre-save middleware to update updatedAt
commentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Mark as edited if content changes and it's not a new document
  if (this.isModified('content') && !this.isNew) {
    this.edited = true;
    this.editedAt = new Date();
  }
  
  next();
});

// Instance method to check if user can edit
commentSchema.methods.canEdit = function() {
  // Users can only edit their own unapproved comments within 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return !this.approved && this.createdAt > oneHourAgo;
};

// Static method to get average rating for a hymn
commentSchema.statics.getAverageRating = async function(hymnId) {
  const result = await this.aggregate([
    {
      $match: {
        hymn: mongoose.Types.ObjectId(hymnId),
        approved: true,
        rating: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$hymn',
        averageRating: { $avg: '$rating' },
        ratingCount: { $sum: 1 },
        totalScore: { $sum: '$rating' }
      }
    }
  ]);
  
  if (result.length > 0) {
    return {
      averageRating: parseFloat(result[0].averageRating.toFixed(1)),
      ratingCount: result[0].ratingCount,
      totalScore: result[0].totalScore
    };
  }
  
  return {
    averageRating: 0,
    ratingCount: 0,
    totalScore: 0
  };
};

// Virtual for formatted created date
commentSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for time ago
commentSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return this.formattedDate;
});

// Set virtuals to true when converting to JSON
commentSchema.set('toJSON', { virtuals: true });
commentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Comment', commentSchema);