const mongoose = require('mongoose');

const hymnSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  lyrics: {
    type: String,
    required: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  lang: {
    type: String,
    required: true,
    enum: ['am', 'om', 'ti', 'en']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  downloads: {
    type: Number,
    default: 0
  },
  listens: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for better performance
hymnSchema.index({ title: 'text', description: 'text', lyrics: 'text' });
hymnSchema.index({ category: 1 });
hymnSchema.index({ lang: 1 });
hymnSchema.index({ isActive: 1 });

module.exports = mongoose.model('Hymn', hymnSchema);