const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['new_hymn', 'system'],
    required: true
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'onModel',
    required: false
  },
  onModel: {
    type: String,
    enum: ['Hymn', 'Category'],
    required: false
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);