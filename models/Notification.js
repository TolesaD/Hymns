const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['new_hymn', 'comment_approved', 'system', 'info', 'warning'],
        default: 'info'
    },
    read: {
        type: Boolean,
        default: false
    },
    relatedHymn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hymn'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { 
    expireAfterSeconds: 30 * 24 * 60 * 60 // Auto-delete after 30 days
});

// Static method to create new hymn notifications for all users
notificationSchema.statics.createNewHymnNotification = async function(hymn, adminUser) {
    try {
        const User = mongoose.model('User');
        
        // Get all users who want new hymn notifications
        const users = await User.find({ 
            'notifications.newHymns': true 
        }).select('_id');
        
        if (users.length === 0) {
            console.log('📢 No users to notify about new hymn');
            return 0;
        }

        const notifications = users.map(user => ({
            user: user._id,
            title: '🎵 New Hymn Added!',
            message: `"${hymn.title}" has been added to the ${hymn.hymnLanguage} ${hymn.category} collection`,
            type: 'new_hymn',
            relatedHymn: hymn._id,
            priority: 'high',
            read: false
        }));

        await this.insertMany(notifications);
        console.log(`📢 Notifications sent to ${users.length} users about new hymn: "${hymn.title}"`);
        
        return users.length;
    } catch (error) {
        console.error('❌ Error creating new hymn notifications:', error);
        throw error;
    }
};

// Static method to create comment approval notification
notificationSchema.statics.createCommentApprovalNotification = async function(comment, hymn) {
    try {
        await this.create({
            user: comment.user,
            title: '💬 Comment Approved!',
            message: `Your comment on "${hymn.title}" has been approved and is now visible to others`,
            type: 'comment_approved',
            relatedHymn: hymn._id,
            priority: 'medium',
            read: false
        });
        
        console.log(`✅ Comment approval notification sent to user: ${comment.user}`);
    } catch (error) {
        console.error('❌ Error creating comment approval notification:', error);
        throw error;
    }
};

module.exports = mongoose.model('Notification', notificationSchema);