const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [30, 'Username cannot exceed 30 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isSubscribed: {
        type: Boolean,
        default: false
    },
    languagePreference: {
        type: String,
        enum: ['english', 'amharic', 'oromo', 'tigrigna'],
        default: 'english'
    },
    notifications: {
        newHymns: {
            type: Boolean,
            default: true
        },
        commentApproved: {
            type: Boolean,
            default: true
        },
        newsletter: {
            type: Boolean,
            default: true
        }
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hymn'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!candidatePassword) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Get unread notifications count
userSchema.methods.getUnreadNotificationsCount = async function() {
    try {
        const Notification = mongoose.model('Notification');
        const count = await Notification.countDocuments({
            user: this._id,
            read: false
        });
        return count;
    } catch (error) {
        console.error('Error getting unread notifications count:', error);
        return 0;
    }
};

// Get recent notifications
userSchema.methods.getRecentNotifications = async function(limit = 10) {
    try {
        const Notification = mongoose.model('Notification');
        const notifications = await Notification.find({
            user: this._id
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('relatedHymn', 'title');
        
        return notifications;
    } catch (error) {
        console.error('Error getting recent notifications:', error);
        return [];
    }
};

// Mark all notifications as read
userSchema.methods.markAllNotificationsRead = async function() {
    try {
        const Notification = mongoose.model('Notification');
        await Notification.updateMany(
            { user: this._id, read: false },
            { $set: { read: true } }
        );
        return true;
    } catch (error) {
        console.error('Error marking all notifications read:', error);
        return false;
    }
};

module.exports = mongoose.model('User', userSchema);