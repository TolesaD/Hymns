const express = require('express');
const router = express.Router();
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const Comment = require('../models/Comment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/audio';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'hymn-' + uniqueSuffix + path.extname(file.originalname));
    }
});

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
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        req.flash('error_msg', 'Admin access required');
        return res.redirect('/users/login');
    }
    next();
};

// Admin dashboard route
router.get(['/', '/dashboard'], requireAdmin, async (req, res) => {
    try {
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

// Add new hymn (POST route) - WITH FILE UPLOAD
router.post('/hymns/add', requireAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        console.log('🎵 POST /admin/hymns/add - Starting hymn creation');
        console.log('📦 Request body:', req.body);
        console.log('📁 Uploaded file:', req.file);
        
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
        
        // Handle audio file
        let audioFilePath = '';
        if (req.file) {
            // File was uploaded successfully
            audioFilePath = '/uploads/audio/' + req.file.filename;
            console.log('📁 Audio file saved at:', audioFilePath);
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
        
        // Clean up uploaded file if there was an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
        
        // More specific error messages
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error_msg', `Validation error: ${messages.join(', ')}`);
        } else if (error.code === 11000) {
            req.flash('error_msg', 'A hymn with this title already exists');
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

// Edit hymn (POST route)
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

        // Handle new audio file upload
        if (req.file) {
            // Delete old audio file if it exists
            if (hymn.audioFile && hymn.audioFile.startsWith('/uploads/audio/')) {
                const oldFilePath = 'public' + hymn.audioFile;
                fs.unlink(oldFilePath, (err) => {
                    if (err) console.error('Error deleting old audio file:', err);
                });
            }
            // Set new audio file path
            hymn.audioFile = '/uploads/audio/' + req.file.filename;
        }

        await hymn.save();
        
        console.log('✅ Hymn updated successfully:', title);
        req.flash('success_msg', `Hymn "${title}" updated successfully!`);
        res.redirect('/admin/hymns');
        
    } catch (error) {
        console.error('❌ Error updating hymn:', error);
        
        // Clean up uploaded file if there was an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
        
        req.flash('error_msg', 'Error updating hymn: ' + error.message);
        res.redirect(`/admin/hymns/edit/${req.params.id}`);
    }
});

// Delete hymn
router.post('/hymns/delete/:id', requireAdmin, async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (hymn) {
            // Delete associated audio file
            if (hymn.audioFile && hymn.audioFile.startsWith('/uploads/audio/')) {
                const filePath = 'public' + hymn.audioFile;
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Error deleting audio file:', err);
                });
            }
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