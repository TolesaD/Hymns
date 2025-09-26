const express = require('express');
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const Hymn = require('../models/Hymn');
const emailService = require('../services/emailService');

const router = express.Router();

// Register Routes (keep your existing code)
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
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });

        if (existingUser) {
            return res.render('register', {
                title: 'Create Account',
                errors: [{ msg: 'User already exists with this email or username' }],
                username: req.body.username || '',
                email: req.body.email || ''
            });
        }

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

// FIXED LOGIN ROUTE - Session Persistence
router.get('/login', (req, res) => {
    if (req.session.user) {
        console.log('User already logged in, redirecting to home');
        return res.redirect('/');
    }
    res.render('login', { 
        title: 'Login',
        errors: [],
        email: '',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').notEmpty()
], async (req, res) => {
    try {
        console.log('🔐 Login attempt for:', req.body.email);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('login', {
                title: 'Login',
                errors: errors.array(),
                email: req.body.email || ''
            });
        }

        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            console.log('❌ User not found:', email);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || ''
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Password mismatch for:', user.username);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || ''
            });
        }

        // Determine if user is admin
        const isAdmin = user.username === 'Tolesa' || user.isAdmin === true;
        console.log('✅ Login successful:', user.username, 'Admin:', isAdmin);

        // Regenerate session for security
        req.session.regenerate((err) => {
            if (err) {
                console.error('❌ Session regenerate error:', err);
                return res.render('login', {
                    title: 'Login',
                    errors: [{ msg: 'Session error. Please try again.' }],
                    email: req.body.email || ''
                });
            }

            // Set session data
            req.session.user = {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                isAdmin: isAdmin
            };

            console.log('💾 Session data set:', req.session.user);

            // Save session and redirect
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('❌ Session save error:', saveErr);
                    return res.render('login', {
                        title: 'Login',
                        errors: [{ msg: 'Login error. Please try again.' }],
                        email: req.body.email || ''
                    });
                }

                console.log('✅ Session saved successfully');
                req.flash('success_msg', `Welcome back, ${user.username}!`);
                
                if (isAdmin) {
                    console.log('➡️ Redirecting to admin dashboard');
                    res.redirect('/admin/dashboard');
                } else {
                    console.log('➡️ Redirecting to homepage');
                    res.redirect('/');
                }
            });
        });

    } catch (error) {
        console.error('💥 Login error:', error);
        req.flash('error_msg', 'Server error during login');
        res.redirect('/users/login');
    }
});

// FIXED LOGOUT ROUTE - Flash message before session destruction
router.get('/logout', (req, res) => {
    const username = req.session.user ? req.session.user.username : 'Unknown user';
    console.log('👋 Logout requested by:', username);
    
    // Store flash message BEFORE destroying session
    req.flash('success_msg', 'You have been logged out successfully.');
    
    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            // Even if session destruction fails, redirect to login
            return res.redirect('/users/login');
        }
        
        // Clear the cookie
        res.clearCookie('connect.sid');
        
        // Redirect to login page
        res.redirect('/users/login');
    });
});

// FIXED PROFILE ROUTE - Better session checking
router.get('/profile', async (req, res) => {
    console.log('👤 Profile access attempt - Session user:', req.session.user);
    
    if (!req.session.user) {
        console.log('❌ No session user - redirecting to login');
        req.flash('error_msg', 'Please log in to view your profile');
        return res.redirect('/users/login');
    }

    try {
        const user = await User.findById(req.session.user.id).populate('favorites');
        if (!user) {
            console.log('❌ User not found in database');
            req.session.destroy(); // Clear invalid session
            req.flash('error_msg', 'User not found. Please log in again.');
            return res.redirect('/users/login');
        }

        console.log('✅ Profile loaded for:', user.username);
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

// FIXED FAVORITES ROUTE
router.post('/favorites/:hymnId', async (req, res) => {
    console.log('❤️ Favorites request - Session user:', req.session.user);
    
    if (!req.session.user) {
        return res.status(401).json({ error: 'Please log in' });
    }

    try {
        const user = await User.findById(req.session.user.id);
        const hymnId = req.params.hymnId;

        if (!user) {
            req.session.destroy();
            return res.status(401).json({ error: 'User not found. Please log in again.' });
        }

        if (user.favorites.includes(hymnId)) {
            user.favorites = user.favorites.filter(id => id.toString() !== hymnId);
            await user.save();
            return res.json({ action: 'removed', message: 'Removed from favorites' });
        } else {
            user.favorites.push(hymnId);
            await user.save();
            return res.json({ action: 'added', message: 'Added to favorites' });
        }
    } catch (error) {
        console.error('Favorites error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Keep your existing password reset routes (they look good)
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
        title: 'Forgot Password - Hymns',
        error_msg: req.flash('error_msg'),
        success_msg: req.flash('success_msg')
    });
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Password reset requested for:', email);

        const user = await User.findOne({ email });

        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            user.resetPasswordToken = resetToken;
            user.resetPasswordExpires = Date.now() + 3600000;
            await user.save();

            const resetLink = `${process.env.APP_URL || req.protocol + '://' + req.get('host')}/users/reset-password/${resetToken}`;
            console.log('Generated reset link:', resetLink);

            const emailSent = await emailService.sendPasswordResetEmail(email, resetToken, resetLink);

            if (emailSent) {
                console.log('Password reset email sent successfully to:', email);
                req.flash('success_msg', 'Password reset link has been sent to your email.');
            } else {
                console.error('Failed to send password reset email to:', email);
                req.flash('error_msg', 'Failed to send email. Please try again later.');
            }
        } else {
            console.log('Password reset requested for non-existent email:', email);
        }

        req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
        res.redirect('/users/login');

    } catch (error) {
        console.error('Forgot password error:', error);
        req.flash('error_msg', 'Error processing request. Please try again.');
        res.redirect('/users/forgot-password');
    }
});

// Keep the rest of your routes (update-profile, change-password, etc.)
router.post('/update-profile', async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

        const { username, email, fullName } = req.body;
        const existingUser = await User.findOne({ username, _id: { $ne: req.session.user.id } });

        if (existingUser) return res.status(400).json({ error: 'Username already taken' });

        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { username, email, fullName },
            { new: true }
        );

        req.session.user.username = username;
        req.session.user.email = email;

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

router.post('/change-password', async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.session.user.id);

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Error changing password' });
    }
});

router.post('/update-notifications', async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

        const { newsletter } = req.body;
        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { isSubscribed: newsletter === 'on' || newsletter === true },
            { new: true }
        );

        req.session.user.isSubscribed = user.isSubscribed;

        res.json({ message: 'Notification preferences updated successfully' });
    } catch (error) {
        console.error('Update notifications error:', error);
        res.status(500).json({ error: 'Error updating notification preferences' });
    }
});

module.exports = router;