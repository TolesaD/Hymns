const express = require('express');
const Notification = require('../models/Notification');
const router = express.Router();

// Get user notifications with pagination
router.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [notifications, unreadCount, totalCount] = await Promise.all([
            Notification.find({ 
                user: req.user.id 
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('relatedHymn', 'title hymnLanguage category')
            .lean(),
            
            Notification.countDocuments({ 
                user: req.user.id, 
                read: false 
            }),
            
            Notification.countDocuments({ 
                user: req.user.id 
            })
        ]);

        // Format notifications for client
        const formattedNotifications = notifications.map(notif => ({
            _id: notif._id,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            read: notif.read,
            priority: notif.priority,
            createdAt: notif.createdAt,
            relatedHymn: notif.relatedHymn,
            timeAgo: getTimeAgo(notif.createdAt)
        }));

        res.json({
            notifications: formattedNotifications,
            unreadCount,
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: page * limit < totalCount
        });
    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
router.post('/:id/read', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const notification = await Notification.findOneAndUpdate(
            { 
                _id: req.params.id, 
                user: req.user.id 
            },
            { 
                read: true,
                readAt: new Date()
            },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Get updated unread count
        const unreadCount = await Notification.countDocuments({ 
            user: req.user.id, 
            read: false 
        });

        res.json({ 
            message: 'Notification marked as read',
            unreadCount 
        });
    } catch (error) {
        console.error('❌ Error marking notification read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark all notifications as read
router.post('/read-all', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = await Notification.updateMany(
            { 
                user: req.user.id, 
                read: false 
            },
            { 
                read: true,
                readAt: new Date()
            }
        );

        res.json({ 
            message: `Marked ${result.modifiedCount} notifications as read`,
            unreadCount: 0
        });
    } catch (error) {
        console.error('❌ Error marking all notifications read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check for new hymns (for notification badge) - ENHANCED
router.get('/check-new-hymns', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Count unread new hymn notifications from last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const newHymnsCount = await Notification.countDocuments({
            user: req.user.id,
            type: 'new_hymn',
            read: false,
            createdAt: { $gte: sevenDaysAgo }
        });

        // Also get total unread count
        const totalUnreadCount = await Notification.countDocuments({
            user: req.user.id,
            read: false
        });

        res.json({ 
            newHymnsCount,
            totalUnreadCount,
            hasNewHymns: newHymnsCount > 0
        });
    } catch (error) {
        console.error('❌ Error checking new hymns:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Get updated counts
        const unreadCount = await Notification.countDocuments({ 
            user: req.user.id, 
            read: false 
        });

        res.json({ 
            message: 'Notification deleted',
            unreadCount 
        });
    } catch (error) {
        console.error('❌ Error deleting notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get notification settings (if you have user notification preferences)
router.get('/settings', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const User = require('../models/User');
        const user = await User.findById(req.user.id).select('notifications');

        res.json({ settings: user.notifications });
    } catch (error) {
        console.error('❌ Error fetching notification settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update notification settings
router.put('/settings', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { newHymns, commentApprovals, systemUpdates } = req.body;
        const User = require('../models/User');

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                'notifications.newHymns': newHymns,
                'notifications.commentApprovals': commentApprovals,
                'notifications.systemUpdates': systemUpdates
            },
            { new: true }
        ).select('notifications');

        res.json({ 
            message: 'Notification settings updated',
            settings: user.notifications 
        });
    } catch (error) {
        console.error('❌ Error updating notification settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to format time ago
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
}

module.exports = router;