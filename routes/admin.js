const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const Comment = require('../models/Comment');
const storageService = require('../services/storageService'); // ✅ Backblaze B2 service
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

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
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

// --------------------
// Admin Dashboard
// --------------------
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

// --------------------
// Add Hymn Form
// --------------------
router.get('/hymns/add', isAdmin, (req, res) => {
    res.render('admin/add-hymn', { title: 'Add New Hymn' });
});

// Middleware to inject storage status
router.use('/hymns/add', (req, res, next) => {
    res.locals.storageStatus = storageService.getStatus();
    next();
});

// Add Hymn with improved error handling and B2 fallback
router.post('/hymns/add', isAdmin, upload.single('audioFile'), async (req, res) => {
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
router.get('/hymns', isAdmin, async (req, res) => {
    try {
        const hymns = await Hymn.find().sort({ createdAt: -1 });
        res.render('admin/hymns', { title: 'Manage Hymns', hymns });
    } catch (error) {
        console.error('Error loading hymns:', error);
        req.flash('error_msg', 'Error loading hymns');
        res.redirect('/admin');
    }
});

// --------------------
// Edit Hymn
// --------------------
router.get('/hymns/edit/:id', isAdmin, async (req, res) => {
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

router.post('/hymns/edit/:id', isAdmin, upload.single('audioFile'), async (req, res) => {
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
router.post('/hymns/delete/:id', isAdmin, async (req, res) => {
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

// --------------------
// Comments
// --------------------
router.get('/comments', isAdmin, async (req, res) => {
    try {
        const pendingComments = await Comment.find({ approved: false }).populate('user', 'username').populate('hymn', 'title').sort({ createdAt: -1 });
        const approvedComments = await Comment.find({ approved: true }).populate('user', 'username').populate('hymn', 'title').sort({ createdAt: -1 }).limit(20);
        res.render('admin/comments', { title: 'Moderate Comments', pendingComments, approvedComments });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading comments');
        res.redirect('/admin');
    }
});

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