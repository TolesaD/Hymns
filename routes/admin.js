const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const Comment = require('../models/Comment');
const storageService = require('../services/storageService'); // ✅ Backblaze B2 service
const router = express.Router();

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
    console.log('🔐 Admin check - Session user:', req.session.user);
    
    if (!req.session.user) {
        console.log('❌ No user session');
        req.flash('error_msg', 'Please log in to access admin panel');
        return res.redirect('/admin/login');
    }
    
    if (!req.session.user.isAdmin) {
        console.log('❌ User is not admin:', req.session.user.username);
        req.flash('error_msg', 'Admin access required');
        return res.redirect('/');
    }
    
    console.log('✅ Admin access granted for:', req.session.user.username);
    next();
};

// Admin login page
router.get('/login', (req, res) => {
    if (req.session.user && req.session.user.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    
    res.render('admin/login', {
        title: 'Admin Login - Hymns',
        error_msg: req.flash('error_msg'),
        success_msg: req.flash('success_msg')
    });
});

// Admin login handler
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔐 Admin login attempt for:', email);

        // Find user by email and check if admin
        const user = await User.findOne({ 
            email: email.toLowerCase().trim(),
            $or: [
                { username: 'Tolesa' },
                { isAdmin: true }
            ]
        });

        if (!user) {
            console.log('❌ Admin user not found or not admin:', email);
            req.flash('error_msg', 'Invalid credentials or not an admin');
            return res.redirect('/admin/login');
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Invalid password for admin:', user.username);
            req.flash('error_msg', 'Invalid credentials');
            return res.redirect('/admin/login');
        }

        // Regenerate session for security
        req.session.regenerate((err) => {
            if (err) {
                console.error('❌ Session regenerate error:', err);
                req.flash('error_msg', 'Login error');
                return res.redirect('/admin/login');
            }

            // Set admin session
            req.session.user = {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                isAdmin: true
            };

            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('❌ Session save error:', saveErr);
                    req.flash('error_msg', 'Login error');
                    return res.redirect('/admin/login');
                }

                console.log('✅ Admin login successful:', user.username);
                req.flash('success_msg', `Welcome back, ${user.username}!`);
                res.redirect('/admin/dashboard');
            });
        });

    } catch (error) {
        console.error('💥 Admin login error:', error);
        req.flash('error_msg', 'Login error');
        res.redirect('/admin/login');
    }
});

// Admin dashboard (protected)
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        const hymnCount = await Hymn.countDocuments() || 0;
        const userCount = await User.countDocuments() || 0;
        const commentCount = await Comment.countDocuments() || 0;
        const pendingComments = await Comment.countDocuments({ approved: false }) || 0;
        const popularHymns = await Hymn.find().sort({ plays: -1 }).limit(5) || [];

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            hymnCount,
            userCount,
            commentCount,
            pendingComments,
            popularHymns,
            user: req.session.user
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            hymnCount: 0,
            userCount: 0,
            commentCount: 0,
            pendingComments: 0,
            popularHymns: [],
            user: req.session.user
        });
    }
});

// Admin logout
router.get('/logout', (req, res) => {
    console.log('👋 Admin logout:', req.session.user?.username);
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/admin/login');
    });
});

// --------------------
// Add Hymn Form
// --------------------
router.get('/hymns/add', requireAdmin, (req, res) => {
    res.render('admin/add-hymn', { title: 'Add New Hymn' });
});

// Middleware to inject storage status
router.use('/hymns/add', (req, res, next) => {
    res.locals.storageStatus = storageService.getStatus();
    next();
});

// Add Hymn with improved error handling and B2 fallback
router.post('/hymns/add', requireAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error_msg', 'Audio file is required');
            return res.redirect('/admin/hymns/add');
        }

        console.log('Storage service status:', storageService.getStatus());
        let audioUrl;

        try {
            const uploadResult = await storageService.uploadFile(req.file.path, `hymns/${Date.now()}-${req.file.originalname}`);
            audioUrl = uploadResult.publicUrl;

            if (uploadResult.isLocal) {
                req.flash('info_msg', 'Hymn added using local storage (Backblaze B2 not configured)');
            } else {
                req.flash('success_msg', 'Hymn uploaded to Backblaze B2 successfully!');
            }
        } catch (uploadError) {
            console.error('Upload error:', uploadError);
            audioUrl = `/uploads/${req.file.filename}`;
            req.flash('warning_msg', 'Hymn added with local storage fallback. Backblaze B2: ' + uploadError.message);
        }

        const { title, description, hymnLanguage, category, lyrics, featured, duration } = req.body;
        const newHymn = new Hymn({
            title,
            description,
            hymnLanguage,
            category,
            audioFile: audioUrl,
            lyrics,
            duration: parseInt(duration) || 0,
            featured: featured === 'on',
            plays: 0,
            downloads: 0,
            rating: 0,
            ratingCount: 0
        });

        await newHymn.save();

        try {
            fs.unlinkSync(req.file.path); // cleanup local file
        } catch (cleanupError) {
            console.error('File cleanup error:', cleanupError);
        }

        res.redirect('/admin/hymns');
    } catch (error) {
        console.error('Add hymn error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError);
            }
        }
        req.flash('error_msg', 'Error adding hymn: ' + error.message);
        res.redirect('/admin/hymns/add');
    }
});

// --------------------
// Manage Hymns
// --------------------
router.get('/hymns', requireAdmin, async (req, res) => {
    try {
        const hymns = await Hymn.find().sort({ createdAt: -1 });
        res.render('admin/hymns', { title: 'Manage Hymns', hymns });
    } catch (error) {
        console.error('Error loading hymns:', error);
        req.flash('error_msg', 'Error loading hymns');
        res.redirect('/admin/dashboard');
    }
});

// --------------------
// Edit Hymn
// --------------------
router.get('/hymns/edit/:id', requireAdmin, async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }
        res.render('admin/edit-hymn', { title: 'Edit Hymn', hymn });
    } catch (error) {
        console.error('Error loading hymn for edit:', error);
        req.flash('error_msg', 'Error loading hymn');
        res.redirect('/admin/hymns');
    }
});

router.post('/hymns/edit/:id', requireAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }

        const { title, description, hymnLanguage, category, lyrics, featured } = req.body;
        hymn.title = title;
        hymn.description = description;
        hymn.hymnLanguage = hymnLanguage;
        hymn.category = category;
        hymn.lyrics = lyrics;
        hymn.featured = featured === 'on';

        if (req.file) {
            try {
                const uploadResult = await storageService.uploadFile(req.file.path, `hymns/${Date.now()}-${req.file.originalname}`);
                hymn.audioFile = uploadResult.publicUrl;
            } catch (uploadError) {
                hymn.audioFile = `/uploads/${req.file.filename}`;
                req.flash('warning_msg', 'Audio updated with local fallback: ' + uploadError.message);
            }

            try { fs.unlinkSync(req.file.path); } catch (cleanupError) { console.error('Cleanup error:', cleanupError); }
        }

        await hymn.save();
        req.flash('success_msg', `Hymn "${hymn.title}" updated successfully!`);
        res.redirect('/admin/hymns');
    } catch (error) {
        console.error('Error updating hymn:', error);
        req.flash('error_msg', 'Error updating hymn: ' + error.message);
        res.redirect(`/admin/hymns/edit/${req.params.id}`);
    }
});

// --------------------
// Delete Hymn
// --------------------
router.post('/hymns/delete/:id', requireAdmin, async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }
        await Hymn.findByIdAndDelete(req.params.id);
        req.flash('success_msg', `Hymn "${hymn.title}" deleted successfully!`);
        res.redirect('/admin/hymns');
    } catch (error) {
        console.error('Error deleting hymn:', error);
        req.flash('error_msg', 'Error deleting hymn');
        res.redirect('/admin/hymns');
    }
});

// --------------------
// User Management
// --------------------
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.render('admin/users', { title: 'Manage Users', users });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading users');
        res.redirect('/admin/dashboard');
    }
});

// --------------------
// Comments
// --------------------
router.get('/comments', requireAdmin, async (req, res) => {
    try {
        const pendingComments = await Comment.find({ approved: false }).populate('user', 'username').populate('hymn', 'title').sort({ createdAt: -1 });
        const approvedComments = await Comment.find({ approved: true }).populate('user', 'username').populate('hymn', 'title').sort({ createdAt: -1 }).limit(20);
        res.render('admin/comments', { title: 'Moderate Comments', pendingComments, approvedComments });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading comments');
        res.redirect('/admin/dashboard');
    }
});

router.post('/comments/approve/:id', requireAdmin, async (req, res) => {
    try {
        await Comment.findByIdAndUpdate(req.params.id, { approved: true });
        req.flash('success_msg', 'Comment approved');
        res.redirect('/admin/comments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error approving comment');
        res.redirect('/admin/comments');
    }
});

router.post('/comments/delete/:id', requireAdmin, async (req, res) => {
    try {
        await Comment.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Comment deleted');
        res.redirect('/admin/comments');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting comment');
        res.redirect('/admin/comments');
    }
});

module.exports = router;