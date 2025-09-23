const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const Comment = require('../models/Comment');
const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.isAdmin) {
        next();
    } else {
        req.flash('error_msg', 'Admin access required');
        res.redirect('/users/login');
    }
};

// ✅ Fix Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// Add hymn form
router.get('/hymns/add', isAdmin, (req, res) => {
    res.render('admin/add-hymn', { title: 'Add New Hymn' });
});

// ✅ Add hymn with improved validation + error handling
router.post('/hymns/add', isAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Uploaded file:', req.file);

        const { title, description, hymnLanguage, category, lyrics, featured } = req.body;

        // Validation
        const errors = [];
        if (!title?.trim()) errors.push('Title is required');
        if (!description?.trim()) errors.push('Description is required');
        if (!hymnLanguage) errors.push('Language is required');
        if (!category) errors.push('Category is required');
        if (!lyrics?.trim()) errors.push('Lyrics are required');

        if (errors.length > 0) {
            req.flash('error_msg', errors.join(', '));
            return res.redirect('/admin/hymns/add');
        }

        // Allowed values
        const validLanguages = ['amharic', 'oromo', 'tigrigna', 'english'];
        const validCategories = ['worship', 'praise', 'thanksgiving', 'slow'];

        const cleanLanguage = hymnLanguage.toLowerCase().trim();
        const cleanCategory = category.toLowerCase().trim();

        if (!validLanguages.includes(cleanLanguage)) {
            req.flash('error_msg', `Invalid language. Must be one of: ${validLanguages.join(', ')}`);
            return res.redirect('/admin/hymns/add');
        }
        if (!validCategories.includes(cleanCategory)) {
            req.flash('error_msg', `Invalid category. Must be one of: ${validCategories.join(', ')}`);
            return res.redirect('/admin/hymns/add');
        }

        // File handling
        let audioFilePath = '/uploads/sample.mp3'; // fallback
        if (req.file) {
            audioFilePath = '/uploads/' + req.file.filename;
        } else {
            const defaultFilePath = path.join(__dirname, '../public/uploads/sample.mp3');
            if (!fs.existsSync(defaultFilePath)) {
                console.log('⚠️ Default sample file not found, using placeholder path');
            }
        }

        // Check duplicates
        const existingHymn = await Hymn.findOne({
            title: { $regex: new RegExp('^' + title.trim() + '$', 'i') },
            hymnLanguage: cleanLanguage
        });
        if (existingHymn) {
            req.flash('error_msg', 'A hymn with this title already exists in the selected language.');
            return res.redirect('/admin/hymns/add');
        }

        // Create hymn
        const hymn = new Hymn({
            title: title.trim(),
            description: description.trim(),
            hymnLanguage: cleanLanguage,
            category: cleanCategory,
            lyrics: lyrics.trim(),
            audioFile: audioFilePath,
            featured: featured === 'on',
            plays: 0,
            downloads: 0,
            rating: 0,
            ratingCount: 0
        });

        // Additional validations
        if (hymn.title.length < 2) {
            req.flash('error_msg', 'Title must be at least 2 characters long');
            return res.redirect('/admin/hymns/add');
        }
        if (hymn.description.length < 10) {
            req.flash('error_msg', 'Description must be at least 10 characters long');
            return res.redirect('/admin/hymns/add');
        }
        if (hymn.lyrics.length < 10) {
            req.flash('error_msg', 'Lyrics must be at least 10 characters long');
            return res.redirect('/admin/hymns/add');
        }

        await hymn.save();
        console.log('✅ Hymn saved successfully:', hymn._id);

        req.flash('success_msg', `Hymn "${hymn.title}" added successfully!`);
        res.redirect('/admin/hymns');

    } catch (error) {
        console.error('❌ Error adding hymn:', error);

        let errorMessage = 'Error adding hymn. Please try again.';
        if (error.name === 'ValidationError') {
            errorMessage = 'Validation errors: ' + Object.values(error.errors).map(err => err.message).join(', ');
        } else if (error.code === 11000) {
            errorMessage = 'A hymn with this title already exists.';
        } else if (error.code === 'LIMIT_FILE_SIZE') {
            errorMessage = 'File too large. Maximum size is 10MB.';
        } else if (error.message.includes('audio files')) {
            errorMessage = 'Only audio files are allowed (MP3, WAV, etc.).';
        } else {
            errorMessage = error.message;
        }

        req.flash('error_msg', errorMessage);
        res.redirect('/admin/hymns/add');
    }
});

// Manage hymns page
router.get('/hymns', isAdmin, async (req, res) => {
    try {
        const hymns = await Hymn.find().sort({ createdAt: -1 });
        
        res.render('admin/hymns', {
            title: 'Manage Hymns',
            hymns: hymns
        });
    } catch (error) {
        console.error('Error loading hymns:', error);
        req.flash('error_msg', 'Error loading hymns');
        res.redirect('/admin');
    }
});

// Admin dashboard
router.get('/', isAdmin, async (req, res) => {
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

// Edit hymn form
router.get('/hymns/edit/:id', isAdmin, async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }
        
        res.render('admin/edit-hymn', {
            title: 'Edit Hymn',
            hymn: hymn
        });
    } catch (error) {
        console.error('Error loading hymn for edit:', error);
        req.flash('error_msg', 'Error loading hymn');
        res.redirect('/admin/hymns');
    }
});

// Update hymn
router.post('/hymns/edit/:id', isAdmin, upload.single('audioFile'), async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }

        const { title, description, hymnLanguage, category, lyrics, featured } = req.body;
        
        // Basic validation
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

        // Update hymn fields
        hymn.title = title.trim();
        hymn.description = description.trim();
        hymn.hymnLanguage = hymnLanguage.toLowerCase().trim();
        hymn.category = category.toLowerCase().trim();
        hymn.lyrics = lyrics.trim();
        hymn.featured = featured === 'on';

        // Update audio file if new one is uploaded
        if (req.file) {
            hymn.audioFile = '/uploads/' + req.file.filename;
        }

        await hymn.save();
        console.log('✅ Hymn updated successfully:', hymn._id);
        
        req.flash('success_msg', `Hymn "${hymn.title}" updated successfully!`);
        res.redirect('/admin/hymns');
        
    } catch (error) {
        console.error('Error updating hymn:', error);
        
        let errorMessage = 'Error updating hymn. Please try again.';
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            errorMessage = errors.join(', ');
        } else if (error.code === 11000) {
            errorMessage = 'A hymn with this title already exists.';
        } else if (error.code === 'LIMIT_FILE_SIZE') {
            errorMessage = 'File too large. Maximum size is 10MB.';
        } else {
            errorMessage = error.message;
        }
        
        req.flash('error_msg', errorMessage);
        res.redirect(`/admin/hymns/edit/${req.params.id}`);
    }
});

// Delete hymn
router.post('/hymns/delete/:id', isAdmin, async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/admin/hymns');
        }

        await Hymn.findByIdAndDelete(req.params.id);
        console.log('✅ Hymn deleted successfully:', req.params.id);
        
        req.flash('success_msg', `Hymn "${hymn.title}" deleted successfully!`);
        res.redirect('/admin/hymns');
        
    } catch (error) {
        console.error('Error deleting hymn:', error);
        req.flash('error_msg', 'Error deleting hymn');
        res.redirect('/admin/hymns');
    }
});

// User management
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.render('admin/users', { title: 'Manage Users', users });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading users');
        res.redirect('/admin');
    }
});

// Comment moderation
router.get('/comments', isAdmin, async (req, res) => {
    try {
        const pendingComments = await Comment.find({ approved: false })
            .populate('user', 'username')
            .populate('hymn', 'title')
            .sort({ createdAt: -1 });

        const approvedComments = await Comment.find({ approved: true })
            .populate('user', 'username')
            .populate('hymn', 'title')
            .sort({ createdAt: -1 })
            .limit(20);

        res.render('admin/comments', { title: 'Moderate Comments', pendingComments, approvedComments });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading comments');
        res.redirect('/admin');
    }
});

// Approve comment
router.post('/comments/approve/:id', isAdmin, async (req, res) => {
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

// Delete comment
router.post('/comments/delete/:id', isAdmin, async (req, res) => {
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