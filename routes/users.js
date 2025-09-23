const express = require('express');
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const Hymn = require('../models/Hymn');
const router = express.Router();

// Register route
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('register', { 
        title: 'Create Account',
        errors: [],
        username: '',
        email: ''
    });
});

router.post('/register', [
    check('username', 'Username is required').notEmpty().isLength({ min: 3 }),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('confirmPassword', 'Passwords do not match').custom((value, { req }) => {
        return value === req.body.password;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('register', {
                title: 'Create Account',
                errors: errors.array(),
                username: req.body.username || '',
                email: req.body.email || ''
            });
        }
        
        const { username, email, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.render('register', {
                title: 'Create Account',
                errors: [{ msg: 'User already exists with this email or username' }],
                username: req.body.username || '',
                email: req.body.email || ''
            });
        }
        
        // Create user
        const user = new User({ 
            username, 
            email, 
            password,
            isSubscribed: req.body.newsletter === 'on'
        });
        await user.save();
        
        req.flash('success_msg', 'Registration successful. You can now log in.');
        res.redirect('/users/login');
    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error_msg', 'Server error during registration');
        res.redirect('/users/register');
    }
});

// Login route
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { 
        title: 'Login',
        errors: [],
        email: ''
    });
});

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('login', {
                title: 'Login',
                errors: errors.array(),
                email: req.body.email || ''
            });
        }
        
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || ''
            });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || ''
            });
        }
        
        // Check if user is admin
        const isAdmin = user.username === 'Tolesa';
        
        // Create session
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: isAdmin
        };
        
        req.flash('success_msg', `Login successful${isAdmin ? ' as Admin' : ''}`);
        
        // Redirect admin to admin panel
        if (isAdmin) {
            res.redirect('/admin');
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error('Login error:', error);
        req.flash('error_msg', 'Server error during login');
        res.redirect('/users/login');
    }
});

// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy();
    req.flash('success_msg', 'You have been logged out');
    res.redirect('/');
});

// Profile route
router.get('/profile', async (req, res) => {
    if (!req.session.user) {
        req.flash('error_msg', 'Please log in to view your profile');
        return res.redirect('/users/login');
    }
    
    try {
        const user = await User.findById(req.session.user.id).populate('favorites');
        if (!user) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/');
        }
        
        res.render('profile', {
            title: 'My Profile',
            user: user
        });
    } catch (error) {
        console.error('Profile error:', error);
        req.flash('error_msg', 'Error loading profile');
        res.redirect('/');
    }
});

// Add to favorites
router.post('/favorites/:hymnId', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Please log in' });
    }
    
    try {
        const user = await User.findById(req.session.user.id);
        const hymnId = req.params.hymnId;
        
        if (user.favorites.includes(hymnId)) {
            // Remove from favorites
            user.favorites = user.favorites.filter(id => id.toString() !== hymnId);
            await user.save();
            return res.json({ action: 'removed', message: 'Removed from favorites' });
        } else {
            // Add to favorites
            user.favorites.push(hymnId);
            await user.save();
            return res.json({ action: 'added', message: 'Added to favorites' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;