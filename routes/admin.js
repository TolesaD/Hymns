const express = require('express');
const router = express.Router();
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const multer = require('multer');
const supabaseService = require('../services/supabaseService');
const fs = require('fs'); // ADD THIS IMPORT
const path = require('path'); // ADD THIS IMPORT

// Configure multer for memory storage (Vercel compatible)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// STRICT Admin middleware - Only Tolesa with correct email
const requireAdmin = (req, res, next) => {
    console.log('🔐 STRICT Admin access check - User:', req.user);
    
    if (!req.user) {
        console.log('❌ No user - redirecting to login');
        req.flash('error_msg', 'Please log in to access admin area');
        return res.redirect('/users/login');
    }
    
    // STRICT: Only Tolesa with marosetofficial@gmail.com is admin
    const isTolesa = req.user.username === 'Tolesa';
    const isCorrectEmail = req.user.email === 'marosetofficial@gmail.com';
    const isAdmin = isTolesa && isCorrectEmail && req.user.isAdmin === true;
    
    console.log('🔍 STRICT Admin middleware check:', {
        username: req.user.username,
        isTolesa: isTolesa,
        email: req.user.email,
        isCorrectEmail: isCorrectEmail,
        sessionAdminFlag: req.user.isAdmin,
        finalIsAdmin: isAdmin
    });
    
    if (!isAdmin) {
        console.log('❌ User is not the designated admin');
        req.flash('error_msg', 'Admin access required');
        return res.redirect('/');
    }
    
    console.log('✅ Admin access granted for:', req.user.username);
    next();
};

// Helper function to update hymn rating
async function updateHymnRating(hymnId) {
    try {
        console.log('📊 Updating hymn rating for:', hymnId);
        
        const result = await Comment.aggregate([
            {
                $match: {
                    hymn: new mongoose.Types.ObjectId(hymnId),
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

// Admin dashboard route
router.get(['/', '/dashboard'], requireAdmin, async (req, res) => {
    try {
        console.log('📊 Admin dashboard accessed by:', req.user.username);
        
        const hymnCount = await Hymn.countDocuments();
        const userCount = await User.countDocuments();
        const commentCount = await Comment.countDocuments();
        const pendingComments = await Comment.countDocuments({ approved: false });
        
        // ADD: Get recent notifications count
        const recentNotifications = await Notification.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        const popularHymns = await Hymn.find().sort({ plays: -1 }).limit(5);
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.user,
            hymnCount,
            userCount,
            commentCount,
            pendingComments,
            recentNotifications, // ADD THIS
            popularHymns,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        req.flash('error_msg', 'Error loading dashboard');
        res.redirect('/admin');
    }
});

// Manage hymns route
router.get('/hymns', requireAdmin, async (req, res) => {
    try {
        const hymns = await Hymn.find().sort({ createdAt: -1 });
        res.render('admin/hymns', {
            title: 'Manage Hymns',
            user: req.user,
            hymns,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Hymns management error:', error);
        req.flash('error_msg', 'Error loading hymns');
        res.redirect('/admin');
    }
});

// Add new hymn form (GET)
router.get('/hymns/add', requireAdmin, (req, res) => {
    res.render('admin/add-hymn', {
        title: 'Add New Hymn',
        user: req.user,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

// Add new hymn (POST route) - FIXED VERSION
router.post('/hymns/add', requireAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        console.log('🎵 POST /admin/hymns/add - Starting hymn creation');
        
        const { title, description, hymnLanguage, category, lyrics, duration, featured } = req.body;
        
        // Validate required fields with better messages
        if (!title || !title.trim()) {
            req.flash('error_msg', '📝 Hymn title is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!description || !description.trim()) {
            req.flash('error_msg', '📄 Hymn description is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!hymnLanguage) {
            req.flash('error_msg', '🌍 Language selection is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!category) {
            req.flash('error_msg', '📂 Category selection is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!lyrics || !lyrics.trim()) {
            req.flash('error_msg', '🎶 Hymn lyrics are required');
            return res.redirect('/admin/hymns/add');
        }
        
        console.log('✅ All validation passed');
        
        // Handle audio file with Supabase - WITH FALLBACK
        let audioFileUrl = '';
        let supabaseFilePath = '';
        
        if (req.file) {
            try {
                console.log('📤 Uploading to Supabase...');
                const uploadResult = await supabaseService.uploadFile(
                    req.file.buffer,
                    req.file.originalname,
                    req.file.mimetype
                );
                
                audioFileUrl = uploadResult.publicUrl;
                supabaseFilePath = uploadResult.filePath;
                console.log('✅ File uploaded to Supabase:', audioFileUrl);
                
            } catch (uploadError) {
                console.error('❌ Supabase upload failed:', uploadError);
                
                // FALLBACK: Use local storage if Supabase fails
                const localFileName = `${Date.now()}-${req.file.originalname}`;
                const uploadsDir = path.join(__dirname, '../uploads');
                
                // Ensure uploads directory exists
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }
                
                const localPath = path.join(uploadsDir, localFileName);
                
                // Save file locally
                fs.writeFileSync(localPath, req.file.buffer);
                audioFileUrl = `/uploads/${localFileName}`;
                
                console.log('📁 File saved locally as fallback:', audioFileUrl);
                req.flash('warning_msg', 'File saved locally (cloud storage unavailable)');
            }
        } else {
            req.flash('error_msg', '🎵 Audio file is required');
            return res.redirect('/admin/hymns/add');
        }
        
        // Create new hymn
        const newHymn = new Hymn({
            title: title.trim(),
            description: description.trim(),
            hymnLanguage: hymnLanguage.trim(),
            category: category.trim(),
            audioFile: audioFileUrl,
            supabaseFilePath: supabaseFilePath,
            lyrics: lyrics.trim(),
            duration: duration ? parseInt(duration) : 180,
            featured: featured === 'on'
        });
        
        console.log('💾 Saving hymn to database');
        await newHymn.save();

        // CREATE NOTIFICATIONS FOR ALL USERS
        try {
            console.log('📢 Creating notifications for new hymn...');
            const notifiedCount = await Notification.createNewHymnNotification(newHymn, req.user);
            
            if (notifiedCount > 0) {
                console.log(`✅ Notifications sent to ${notifiedCount} users about new hymn`);
                req.flash('success_msg', `🎵 Hymn "${title}" added successfully! ${notifiedCount} users notified.`);
            } else {
                console.log('ℹ️ No users to notify about new hymn');
                req.flash('success_msg', `🎵 Hymn "${title}" added successfully!`);
            }
        } catch (notifyError) {
            console.error('❌ Error sending notifications:', notifyError);
            req.flash('success_msg', `🎵 Hymn "${title}" added successfully! (Notifications temporarily unavailable)`);
        }

        console.log('✅ Hymn saved successfully with ID:', newHymn._id);
        return res.redirect('/admin/hymns');
        
    } catch (error) {
        console.error('❌ Error adding hymn:', error);
        
        let errorMessage = 'Error adding hymn';
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            errorMessage = `Validation error: ${messages.join(', ')}`;
        } else if (error.code === 11000) {
            errorMessage = 'A hymn with this title already exists';
        } else if (error.code === 'LIMIT_FILE_SIZE') {
            errorMessage = 'File too large. Maximum size is 10MB.';
        } else {
            errorMessage = `Server error: ${error.message}`;
        }
        
        req.flash('error_msg', errorMessage);
        return res.redirect('/admin/hymns/add');
    }
});

// Edit hymn form (GET)
router.get('/hymns/edit/:id', requireAdmin, async (req, res) => {
    try {
        console.log('✏️ Edit hymn form accessed for ID:', req.params.id);
        
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }
        
        res.render('admin/edit-hymn', {
            title: 'Edit Hymn',
            user: req.user,
            hymn,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ Edit hymn error:', error);
        req.flash('error_msg', 'Error loading hymn');
        res.redirect('/admin/hymns');
    }
});

// Edit hymn (POST route) - UPDATED FOR SUPABASE
router.post('/hymns/edit/:id', requireAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        console.log('✏️ POST /admin/hymns/edit - Editing hymn:', req.params.id);
        
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }

        const { title, description, hymnLanguage, category, lyrics, duration, featured } = req.body;
        
        // Validate required fields
        if (!title || !title.trim()) {
            req.flash('error_msg', 'Title is required');
            return res.redirect(`/admin/hymns/edit/${req.params.id}`);
        }
        if (!description || !description.trim()) {
            req.flash('error_msg', 'Description is required');
            return res.redirect(`/admin/hymns/edit/${req.params.id}`);
        }
        if (!hymnLanguage) {
            req.flash('error_msg', 'Language is required');
            return res.redirect(`/admin/hymns/edit/${req.params.id}`);
        }
        if (!category) {
            req.flash('error_msg', 'Category is required');
            return res.redirect(`/admin/hymns/edit/${req.params.id}`);
        }
        if (!lyrics || !lyrics.trim()) {
            req.flash('error_msg', 'Lyrics are required');
            return res.redirect(`/admin/hymns/edit/${req.params.id}`);
        }

        // Handle new audio file upload with Supabase
        if (req.file) {
            try {
                console.log('📤 Uploading new file to Supabase...');
                const uploadResult = await supabaseService.updateFile(
                    hymn.supabaseFilePath, // Old file path for deletion
                    req.file.buffer,
                    req.file.originalname,
                    req.file.mimetype
                );
                
                hymn.audioFile = uploadResult.publicUrl;
                hymn.supabaseFilePath = uploadResult.filePath;
                console.log('✅ New file uploaded to Supabase:', hymn.audioFile);
                
            } catch (uploadError) {
                console.error('❌ Supabase upload failed:', uploadError);
                req.flash('error_msg', 'File upload failed: ' + uploadError.message);
                return res.redirect(`/admin/hymns/edit/${req.params.id}`);
            }
        }

        // Update hymn data
        hymn.title = title.trim();
        hymn.description = description.trim();
        hymn.hymnLanguage = hymnLanguage;
        hymn.category = category;
        hymn.lyrics = lyrics.trim();
        hymn.duration = duration ? parseInt(duration) : hymn.duration;
        hymn.featured = featured === 'on';

        await hymn.save();
        
        console.log('✅ Hymn updated successfully:', title);
        req.flash('success_msg', `Hymn "${title}" updated successfully!`);
        res.redirect('/admin/hymns');
        
    } catch (error) {
        console.error('❌ Error updating hymn:', error);
        
        if (error.code === 'LIMIT_FILE_SIZE') {
            req.flash('error_msg', 'File too large. Maximum size is 10MB.');
        } else {
            req.flash('error_msg', 'Error updating hymn: ' + error.message);
        }
        res.redirect(`/admin/hymns/edit/${req.params.id}`);
    }
});

// Delete hymn - UPDATED FOR SUPABASE
router.post('/hymns/delete/:id', requireAdmin, async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (hymn) {
            // Delete file from Supabase if it exists
            if (hymn.supabaseFilePath) {
                await supabaseService.deleteFile(hymn.supabaseFilePath);
            }
            
            await Hymn.findByIdAndDelete(req.params.id);
            req.flash('success_msg', 'Hymn deleted successfully');
        } else {
            req.flash('error_msg', 'Hymn not found');
        }
    } catch (error) {
        console.error('Error deleting hymn:', error);
        req.flash('error_msg', 'Error deleting hymn: ' + error.message);
    }
    res.redirect('/admin/hymns');
});

// =============================================
// USER MANAGEMENT ROUTES - ENHANCED WITH NOTIFICATIONS
// =============================================

// Manage users route
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.render('admin/users', {
            title: 'Manage Users',
            user: req.user,
            users,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Users management error:', error);
        req.flash('error_msg', 'Error loading users');
        res.redirect('/admin');
    }
});

// Block user route - ENHANCED WITH NOTIFICATION
router.post('/users/block/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            // Prevent admin from blocking themselves
            if (user._id.toString() === req.user.id) {
                req.flash('error_msg', 'You cannot block yourself');
                return res.redirect('/admin/users');
            }
            
            // Prevent blocking other admins
            if (user.isAdmin) {
                req.flash('error_msg', 'Cannot block other administrators');
                return res.redirect('/admin/users');
            }
            
            user.isBlocked = true;
            await user.save();

            // CREATE NOTIFICATION FOR THE BLOCKED USER
            try {
                await Notification.create({
                    user: user._id,
                    title: '🚫 Account Temporarily Blocked',
                    message: 'Your account has been temporarily blocked. Please contact support if you believe this is an error.',
                    type: 'warning',
                    priority: 'high',
                    read: false
                });
                console.log(`✅ Block notification sent to user: ${user.username}`);
            } catch (notifyError) {
                console.error('❌ Error sending block notification:', notifyError);
            }
            
            req.flash('success_msg', `User ${user.username} has been blocked successfully. Notification sent to user.`);
        } else {
            req.flash('error_msg', 'User not found');
        }
    } catch (error) {
        console.error('Error blocking user:', error);
        req.flash('error_msg', 'Error blocking user: ' + error.message);
    }
    res.redirect('/admin/users');
});

// Unblock user route - ENHANCED WITH NOTIFICATION
router.post('/users/unblock/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.isBlocked = false;
            await user.save();

            // CREATE NOTIFICATION FOR THE UNBLOCKED USER
            try {
                await Notification.create({
                    user: user._id,
                    title: '✅ Account Restored',
                    message: 'Your account access has been restored. Welcome back!',
                    type: 'info',
                    priority: 'medium',
                    read: false
                });
                console.log(`✅ Unblock notification sent to user: ${user.username}`);
            } catch (notifyError) {
                console.error('❌ Error sending unblock notification:', notifyError);
            }
            
            req.flash('success_msg', `User ${user.username} has been unblocked successfully. Welcome back notification sent.`);
        } else {
            req.flash('error_msg', 'User not found');
        }
    } catch (error) {
        console.error('Error unblocking user:', error);
        req.flash('error_msg', 'Error unblocking user: ' + error.message);
    }
    res.redirect('/admin/users');
});

// Delete user route - ENHANCED WITH CLEANUP
router.post('/users/delete/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            // Prevent admin from deleting themselves
            if (user._id.toString() === req.user.id) {
                req.flash('error_msg', 'You cannot delete yourself');
                return res.redirect('/admin/users');
            }
            
            // Prevent deleting other admins
            if (user.isAdmin) {
                req.flash('error_msg', 'Cannot delete other administrators');
                return res.redirect('/admin/users');
            }
            
            // Delete user's comments
            await Comment.deleteMany({ user: user._id });
            
            // Delete user's notifications
            await Notification.deleteMany({ user: user._id });
            
            await User.findByIdAndDelete(req.params.id);
            req.flash('success_msg', `User ${user.username} has been deleted successfully (comments and notifications cleaned up).`);
        } else {
            req.flash('error_msg', 'User not found');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        req.flash('error_msg', 'Error deleting user: ' + error.message);
    }
    res.redirect('/admin/users');
});

// Bulk block users - ENHANCED
router.post('/users/bulk-block', requireAdmin, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds)) {
            req.flash('error_msg', 'No users selected');
            return res.redirect('/admin/users');
        }

        let blockedCount = 0;
        for (const userId of userIds) {
            const user = await User.findById(userId);
            if (user && !user.isAdmin && user._id.toString() !== req.user.id) {
                user.isBlocked = true;
                await user.save();
                blockedCount++;

                // Send notification to blocked user
                try {
                    await Notification.create({
                        user: user._id,
                        title: '🚫 Account Blocked',
                        message: 'Your account has been temporarily blocked by administration.',
                        type: 'warning',
                        priority: 'high',
                        read: false
                    });
                } catch (notifyError) {
                    console.error('Error sending bulk block notification:', notifyError);
                }
            }
        }

        req.flash('success_msg', `Successfully blocked ${blockedCount} user(s) and sent notifications.`);
    } catch (error) {
        console.error('Error bulk blocking users:', error);
        req.flash('error_msg', 'Error blocking users: ' + error.message);
    }
    res.redirect('/admin/users');
});

// Bulk unblock users - ENHANCED
router.post('/users/bulk-unblock', requireAdmin, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds)) {
            req.flash('error_msg', 'No users selected');
            return res.redirect('/admin/users');
        }

        let unblockedCount = 0;
        for (const userId of userIds) {
            const user = await User.findById(userId);
            if (user && !user.isAdmin) {
                user.isBlocked = false;
                await user.save();
                unblockedCount++;

                // Send notification to unblocked user
                try {
                    await Notification.create({
                        user: user._id,
                        title: '✅ Account Restored',
                        message: 'Your account access has been restored. Welcome back to our community!',
                        type: 'info',
                        priority: 'medium',
                        read: false
                    });
                } catch (notifyError) {
                    console.error('Error sending bulk unblock notification:', notifyError);
                }
            }
        }

        req.flash('success_msg', `Successfully unblocked ${unblockedCount} user(s) and sent welcome back notifications.`);
    } catch (error) {
        console.error('Error bulk unblocking users:', error);
        req.flash('error_msg', 'Error unblocking users: ' + error.message);
    }
    res.redirect('/admin/users');
});

// Bulk delete users - ENHANCED
router.post('/users/bulk-delete', requireAdmin, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds)) {
            req.flash('error_msg', 'No users selected');
            return res.redirect('/admin/users');
        }

        let deletedCount = 0;
        for (const userId of userIds) {
            const user = await User.findById(userId);
            if (user && !user.isAdmin && user._id.toString() !== req.user.id) {
                // Delete user's comments
                await Comment.deleteMany({ user: user._id });
                // Delete user's notifications
                await Notification.deleteMany({ user: user._id });
                await User.findByIdAndDelete(userId);
                deletedCount++;
            }
        }

        req.flash('success_msg', `Successfully deleted ${deletedCount} user(s) and cleaned up their data.`);
    } catch (error) {
        console.error('Error bulk deleting users:', error);
        req.flash('error_msg', 'Error deleting users: ' + error.message);
    }
    res.redirect('/admin/users');
});

// =============================================
// COMMENT MODERATION ROUTES - ENHANCED WITH NOTIFICATIONS
// =============================================

// Comments moderation route
router.get('/comments', requireAdmin, async (req, res) => {
    try {
        console.log('💬 Admin comments moderation accessed');
        
        const pendingComments = await Comment.find({ approved: false })
            .populate('user', 'username email')
            .populate('hymn', 'title')
            .sort({ createdAt: -1 });

        const approvedComments = await Comment.find({ approved: true })
            .populate('user', 'username email')
            .populate('hymn', 'title')
            .sort({ createdAt: -1 });
        
        res.render('admin/comments', {
            title: 'Moderate Comments',
            user: req.user,
            pendingComments: pendingComments || [],
            approvedComments: approvedComments || [],
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ Comments moderation error:', error);
        req.flash('error_msg', 'Error loading comments');
        res.redirect('/admin');
    }
});

// Approve comment route - ENHANCED WITH NOTIFICATIONS
router.post('/comments/approve/:id', requireAdmin, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id)
            .populate('hymn')
            .populate('user', 'username');

        if (!comment) {
            console.log('❌ Comment not found for approval:', req.params.id);
            req.flash('error_msg', 'Comment not found');
            return res.redirect('/admin/comments');
        }

        comment.approved = true;
        await comment.save();

        // Update hymn rating after approval
        await updateHymnRating(comment.hymn._id);

        // SEND NOTIFICATION TO USER ABOUT COMMENT APPROVAL
        try {
            await Notification.createCommentApprovalNotification(comment, comment.hymn);
            console.log(`✅ Comment approval notification sent to user: ${comment.user.username}`);
        } catch (notifyError) {
            console.error('❌ Error sending comment approval notification:', notifyError);
        }

        console.log('✅ Comment approved by admin:', req.user.username, 'for hymn:', comment.hymn.title, 'by user:', comment.user.username);
        
        // SUCCESS: Comment approved and user notified
        req.flash('success_msg', `Comment by ${comment.user.username} approved successfully! User notified and hymn rating updated.`);
        
    } catch (error) {
        console.error('❌ Error approving comment:', error);
        req.flash('error_msg', 'Error approving comment: ' + error.message);
    }
    
    return res.redirect('/admin/comments');
});

// Delete comment route - ENHANCED WITH BETTER FLASH MESSAGES
router.post('/comments/delete/:id', requireAdmin, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id)
            .populate('user', 'username')
            .populate('hymn', 'title');
        
        if (!comment) {
            console.log('❌ Comment not found for deletion:', req.params.id);
            req.flash('error_msg', 'Comment not found');
            return res.redirect('/admin/comments');
        }

        const hymnId = comment.hymn ? comment.hymn._id : null;
        const userName = comment.user ? comment.user.username : 'Unknown User';
        const hymnTitle = comment.hymn ? comment.hymn.title : 'Unknown Hymn';

        await Comment.findByIdAndDelete(req.params.id);

        // Update hymn rating if comment was approved
        if (comment.approved && hymnId) {
            await updateHymnRating(hymnId);
        }

        console.log('🗑️ Comment deleted by admin:', req.user.username, 'Comment by:', userName, 'for hymn:', hymnTitle);
        
        // SUCCESS: Comment deleted
        req.flash('success_msg', `Comment by ${userName} for "${hymnTitle}" has been deleted successfully.`);
        
    } catch (error) {
        console.error('❌ Error deleting comment:', error);
        req.flash('error_msg', 'Error deleting comment: ' + error.message);
    }
    
    return res.redirect('/admin/comments');
});

// =============================================
// NOTIFICATION MANAGEMENT ROUTES (NEW)
// =============================================

// View all system notifications
router.get('/notifications', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const [notifications, totalCount] = await Promise.all([
            Notification.find()
                .populate('user', 'username email')
                .populate('relatedHymn', 'title')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            
            Notification.countDocuments()
        ]);

        res.render('admin/notifications', {
            title: 'System Notifications',
            user: req.user,
            notifications,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Error loading notifications:', error);
        req.flash('error_msg', 'Error loading notifications');
        res.redirect('/admin');
    }
});

// Send system notification to all users
router.post('/notifications/broadcast', requireAdmin, async (req, res) => {
    try {
        const { title, message, priority } = req.body;
        
        if (!title || !message) {
            req.flash('error_msg', 'Title and message are required');
            return res.redirect('/admin/notifications');
        }

        const users = await User.find().select('_id');
        let sentCount = 0;

        for (const user of users) {
            try {
                await Notification.create({
                    user: user._id,
                    title: title.trim(),
                    message: message.trim(),
                    type: 'system',
                    priority: priority || 'medium',
                    read: false
                });
                sentCount++;
            } catch (error) {
                console.error(`Error sending notification to user ${user._id}:`, error);
            }
        }

        req.flash('success_msg', `Broadcast notification sent to ${sentCount} users successfully!`);
    } catch (error) {
        console.error('Error broadcasting notification:', error);
        req.flash('error_msg', 'Error sending broadcast notification');
    }
    
    res.redirect('/admin/notifications');
});

module.exports = router;