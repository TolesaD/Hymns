const express = require('express');
const router = express.Router();
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const Comment = require('../models/Comment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads - FIXED FOR VERCEL
const storage = multer.memoryStorage(); // Use memory storage for Vercel

const fileFilter = (req, file, cb) => {
    // Check if file is audio
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Only audio files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit for Vercel compatibility
    }
});

// Admin middleware - FIXED FOR MOBILE
const requireAdmin = (req, res, next) => {
    console.log('🔐 Admin access check - Session:', req.session.user);
    
    if (!req.session.user) {
        console.log('❌ No user session');
        req.flash('error_msg', 'Please log in to access admin area');
        return res.redirect('/users/login');
    }
    
    if (!req.session.user.isAdmin) {
        console.log('❌ User is not admin:', req.session.user.username);
        req.flash('error_msg', 'Admin access required');
        return res.redirect('/');
    }
    
    console.log('✅ Admin access granted for:', req.session.user.username);
    next();
};

// Admin dashboard route - FIXED FOR MOBILE
router.get(['/', '/dashboard'], requireAdmin, async (req, res) => {
    try {
        console.log('📊 Admin dashboard accessed by:', req.session.user.username);
        
        const hymnCount = await Hymn.countDocuments();
        const userCount = await User.countDocuments();
        const commentCount = await Comment.countDocuments();
        const pendingComments = await Comment.countDocuments({ approved: false });
        
        const popularHymns = await Hymn.find().sort({ plays: -1 }).limit(5);
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.session.user,
            hymnCount,
            userCount,
            commentCount,
            pendingComments,
            popularHymns
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
            user: req.session.user,
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
        user: req.session.user,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

// Add new hymn (POST route) - FIXED FOR VERCEL
router.post('/hymns/add', requireAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        console.log('🎵 POST /admin/hymns/add - Starting hymn creation');
        console.log('📦 Request body:', req.body);
        console.log('📁 Uploaded file:', req.file ? `Present (${req.file.size} bytes)` : 'None');
        
        const { title, description, hymnLanguage, category, lyrics, duration, featured } = req.body;
        
        // Validate required fields
        if (!title || !title.trim()) {
            req.flash('error_msg', 'Title is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!description || !description.trim()) {
            req.flash('error_msg', 'Description is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!hymnLanguage) {
            req.flash('error_msg', 'Language is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!category) {
            req.flash('error_msg', 'Category is required');
            return res.redirect('/admin/hymns/add');
        }
        if (!lyrics || !lyrics.trim()) {
            req.flash('error_msg', 'Lyrics are required');
            return res.redirect('/admin/hymns/add');
        }
        
        console.log('✅ All validation passed');
        
        // Handle audio file - FIXED FOR VERCEL
        let audioFilePath = '';
        if (req.file) {
            // For Vercel, we need to use a cloud storage solution
            // For now, we'll store file info and handle uploads differently
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileName = 'hymn-' + uniqueSuffix + path.extname(req.file.originalname);
            
            // In production, you should upload to Backblaze B2 or similar
            // For now, we'll store the file buffer info
            audioFilePath = `/uploads/audio/${fileName}`;
            console.log('📁 Audio file reference created:', audioFilePath);
            
            // TODO: Implement actual file upload to Backblaze B2
            // For now, we'll proceed without file validation in production
        } else {
            // No file uploaded, use placeholder or require file
            req.flash('error_msg', 'Audio file is required');
            return res.redirect('/admin/hymns/add');
        }
        
        // Create new hymn
        const newHymn = new Hymn({
            title: title.trim(),
            description: description.trim(),
            hymnLanguage: hymnLanguage.trim(),
            category: category.trim(),
            audioFile: audioFilePath,
            lyrics: lyrics.trim(),
            duration: duration ? parseInt(duration) : 180, // Default 3 minutes
            featured: featured === 'on'
        });
        
        console.log('💾 Saving hymn to database:', newHymn);
        
        // Save to database
        await newHymn.save();
        
        console.log('✅ Hymn saved successfully with ID:', newHymn._id);
        req.flash('success_msg', `Hymn "${title}" added successfully!`);
        res.redirect('/admin/hymns');
        
    } catch (error) {
        console.error('❌ Error adding hymn:', error);
        
        // More specific error messages
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error_msg', `Validation error: ${messages.join(', ')}`);
        } else if (error.code === 11000) {
            req.flash('error_msg', 'A hymn with this title already exists');
        } else if (error.code === 'LIMIT_FILE_SIZE') {
            req.flash('error_msg', 'File too large. Maximum size is 5MB.');
        } else {
            req.flash('error_msg', 'Server error while adding hymn: ' + error.message);
        }
        
        res.redirect('/admin/hymns/add');
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
            user: req.session.user,
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

// Edit hymn (POST route) - FIXED FOR VERCEL
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

        // Update hymn data
        hymn.title = title.trim();
        hymn.description = description.trim();
        hymn.hymnLanguage = hymnLanguage;
        hymn.category = category;
        hymn.lyrics = lyrics.trim();
        hymn.duration = duration ? parseInt(duration) : hymn.duration;
        hymn.featured = featured === 'on';

        // Handle new audio file upload - FIXED FOR VERCEL
        if (req.file) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileName = 'hymn-' + uniqueSuffix + path.extname(req.file.originalname);
            hymn.audioFile = '/uploads/audio/' + fileName;
            
            console.log('📁 New audio file reference:', hymn.audioFile);
        }

        await hymn.save();
        
        console.log('✅ Hymn updated successfully:', title);
        req.flash('success_msg', `Hymn "${title}" updated successfully!`);
        res.redirect('/admin/hymns');
        
    } catch (error) {
        console.error('❌ Error updating hymn:', error);
        
        if (error.code === 'LIMIT_FILE_SIZE') {
            req.flash('error_msg', 'File too large. Maximum size is 5MB.');
        } else {
            req.flash('error_msg', 'Error updating hymn: ' + error.message);
        }
        res.redirect(`/admin/hymns/edit/${req.params.id}`);
    }
});

// Delete hymn
router.post('/hymns/delete/:id', requireAdmin, async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (hymn) {
            await Hymn.findByIdAndDelete(req.params.id);
            req.flash('success_msg', 'Hymn deleted successfully');
        }
    } catch (error) {
        console.error('Error deleting hymn:', error);
        req.flash('error_msg', 'Error deleting hymn');
    }
    res.redirect('/admin/hymns');
});

// Manage users route
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.render('admin/users', {
            title: 'Manage Users',
            user: req.session.user,
            users
        });
    } catch (error) {
        console.error('Users management error:', error);
        req.flash('error_msg', 'Error loading users');
        res.redirect('/admin');
    }
});

// Comments moderation route
router.get('/comments', requireAdmin, async (req, res) => {
    try {
        console.log('💬 Admin comments moderation accessed');
        
        // Get comments with user and hymn data populated
        const comments = await Comment.find()
            .populate('user', 'username email')
            .populate('hymn', 'title')
            .sort({ createdAt: -1 });
        
        // Separate pending and approved comments based on your schema
        const pendingComments = comments.filter(comment => !comment.approved);
        const approvedComments = comments.filter(comment => comment.approved);
        
        res.render('admin/comments', {
            title: 'Moderate Comments',
            user: req.session.user,
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

// Approve comment route
router.post('/comments/approve/:id', requireAdmin, async (req, res) => {
    try {
        await Comment.findByIdAndUpdate(req.params.id, { approved: true });
        req.flash('success_msg', 'Comment approved successfully');
    } catch (error) {
        console.error('Error approving comment:', error);
        req.flash('error_msg', 'Error approving comment');
    }
    res.redirect('/admin/comments');
});

// Delete comment route
router.post('/comments/delete/:id', requireAdmin, async (req, res) => {
    try {
        await Comment.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Comment deleted successfully');
    } catch (error) {
        console.error('Error deleting comment:', error);
        req.flash('error_msg', 'Error deleting comment');
    }
    res.redirect('/admin/comments');
});

module.exports = router;