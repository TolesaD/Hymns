const express = require('express');
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const Hymn = require('../models/Hymn');
const emailService = require('../services/emailService');

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

/**
 * =======================
 *  Register Routes
 * =======================
 */
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

/**
 * =======================
 *  Login / Logout Routes
 * =======================
 */
router.get('/login', (req, res) => {
    if (req.session.user) {
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
        console.log('🔐 Login attempt started for:', req.body.email);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.render('login', {
                title: 'Login',
                errors: errors.array(),
                email: req.body.email || '',
                success_msg: [],
                error_msg: []
            });
        }

        const { email, password } = req.body;
        console.log('🔍 Looking for user with email:', email);

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            console.log('❌ User not found for email:', email);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || '',
                success_msg: [],
                error_msg: []
            });
        }

        console.log('✅ User found:', user.username);

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Password mismatch for user:', user.username);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || '',
                success_msg: [],
                error_msg: []
            });
        }

        // Determine if user is admin
        const isAdmin = user.username === 'Tolesa' || user.isAdmin === true;
        console.log('🎉 Login successful. User:', user.username, 'Admin:', isAdmin);

        // Set session data
        req.session.regenerate((err) => {
            if (err) {
                console.error('❌ Session regenerate error:', err);
                return res.render('login', {
                    title: 'Login',
                    errors: [{ msg: 'Session error. Please try again.' }],
                    email: req.body.email || '',
                    success_msg: [],
                    error_msg: []
                });
            }

            req.session.user = {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                isAdmin: isAdmin
            };

            console.log('💾 Session data set:', req.session.user);

            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('❌ Session save error:', saveErr);
                    return res.render('login', {
                        title: 'Login',
                        errors: [{ msg: 'Login error. Please try again.' }],
                        email: req.body.email || '',
                        success_msg: [],
                        error_msg: []
                    });
                }

                console.log('✅ Session saved successfully');
                
                // Set flash message
                req.flash('success_msg', `Welcome back, ${user.username}!`);
                
                // Redirect based on user type
                if (isAdmin) {
                    console.log('➡️ Redirecting to admin dashboard');
                    return res.redirect('/admin/dashboard');
                } else {
                    console.log('➡️ Redirecting to homepage');
                    return res.redirect('/');
                }
            });
        });

    } catch (error) {
        console.error('💥 Login error details:', error);
        console.error('💥 Error stack:', error.stack);
        
        return res.render('login', {
            title: 'Login',
            errors: [{ msg: 'Server error during login. Please try again.' }],
            email: req.body.email || '',
            success_msg: [],
            error_msg: []
        });
    }
});

router.get('/logout', (req, res) => {
    console.log('Logout requested by:', req.session.user?.username);
    req.flash('success_msg', 'You have been logged out');
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        console.log('Session destroyed, redirecting to home');
        res.redirect('/');
    });
});

/**
 * =======================
 *  Password Reset Routes
 * =======================
 */
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

router.get('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or expired.');
            return res.redirect('/users/forgot-password');
        }

        res.render('reset-password', {
            title: 'Reset Password - Hymns',
            token: req.params.token,
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error_msg', 'Error processing request.');
        res.redirect('/users/forgot-password');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            req.flash('error_msg', 'Passwords do not match.');
            return res.redirect(`/users/reset-password/${req.params.token}`);
        }

        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or expired.');
            return res.redirect('/users/forgot-password');
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash('success_msg', 'Password reset successful. You can now log in.');
        res.redirect('/users/login');
    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error_msg', 'Error resetting password.');
        res.redirect(`/users/reset-password/${req.params.token}`);
    }
});

/**
 * =======================
 *  Profile & Settings
 * =======================
 */
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

// Production test route
router.get('/production-test', (req, res) => {
    res.json({
        environment: process.env.NODE_ENV,
        appUrl: process.env.APP_URL,
        sessionUser: req.session.user,
        sessionId: req.sessionID,
        allEnvVars: {
            NODE_ENV: process.env.NODE_ENV,
            APP_URL: process.env.APP_URL || 'Not set',
            MAILERSEND_API_TOKEN: process.env.MAILERSEND_API_TOKEN ? 'Set' : 'Missing',
            B2_KEY_ID: process.env.B2_KEY_ID ? 'Set' : 'Missing',
            MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Missing'
        }
    });
});

// Test email route
router.get('/test-email', async (req, res) => {
    try {
        console.log('Testing email configuration...');
        
        const configTest = await emailService.testConfiguration();
        
        if (!configTest) {
            return res.json({ 
                success: false, 
                message: 'Email service not configured properly' 
            });
        }

        const testEmail = 'tolesadebushe9@gmail.com';
        const testResult = await emailService.sendTestEmail(testEmail);

        res.json({ 
            success: testResult, 
            message: testResult ? 'Test email sent successfully' : 'Failed to send test email'
        });

    } catch (error) {
        console.error('Email test error:', error);
        res.json({ success: false, message: 'Test failed: ' + error.message });
    }
});

module.exports = router;