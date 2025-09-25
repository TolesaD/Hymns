const express = require('express');
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const Hymn = require('../models/Hymn');
const emailService = require('../services/emailService'); // MailerSend service

const router = express.Router();

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
        console.log('Login attempt for:', email);

        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found:', email);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || ''
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Invalid password for:', email);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || ''
            });
        }

        // Determine if user is admin
        const isAdmin = user.username === 'Tolesa' || user.isAdmin === true;
        
        // Set session
        req.session.user = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            isAdmin: isAdmin
        };

        console.log('Login successful:', user.username, 'Admin:', isAdmin);

        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                req.flash('error_msg', 'Login error');
                return res.redirect('/users/login');
            }
            
            req.flash('success_msg', `Welcome back, ${user.username}!`);
            
            if (isAdmin) {
                res.redirect('/admin/dashboard');
            } else {
                res.redirect('/');
            }
        });

    } catch (error) {
        console.error('Login error details:', error);
        req.flash('error_msg', 'Server error during login');
        res.redirect('/users/login');
    }
});

router.get('/logout', (req, res) => {
    req.flash('success_msg', 'You have been logged out');
    req.session.destroy(err => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.redirect('/');
        }
        res.redirect('/');
    });
});

/**
 * =======================
 *  Password Reset Routes
 * =======================
 */
router.get('/test-email', async (req, res) => {
    try {
        console.log('\n' + '='.repeat(50));
        console.log('TESTING MAILERSEND CONFIGURATION');
        console.log('='.repeat(50));

        // Test 1: Basic configuration
        console.log('\n1. Testing basic configuration...');
        const configTest = await emailService.testConfiguration();

        if (!configTest) {
            return res.json({ 
                success: false, 
                message: '❌ Basic configuration failed',
                details: 'Check your .env file for MAILERSEND_API_TOKEN and MAILERSEND_FROM_EMAIL'
            });
        }

        // Test 2: Send actual test email
        console.log('\n2. Sending test email...');
        const testEmail = 'your-email@gmail.com'; // CHANGE THIS TO YOUR REAL EMAIL
        const emailSent = await emailService.sendTestEmail(testEmail);

        if (emailSent) {
            return res.json({ 
                success: true, 
                message: '✅ Test email sent successfully! Check your inbox.',
                next_steps: 'If you dont receive the email within 5 minutes, check: 1) Spam folder 2) MailerSend dashboard 3) API token validity'
            });
        } else {
            return res.json({ 
                success: false, 
                message: '❌ Failed to send test email',
                details: 'Check the terminal logs for detailed error information',
                config: {
                    hasToken: !!process.env.MAILERSEND_API_TOKEN,
                    fromEmail: process.env.MAILERSEND_FROM_EMAIL,
                    fromName: process.env.MAILERSEND_FROM_NAME,
                    tokenLength: process.env.MAILERSEND_API_TOKEN ? process.env.MAILERSEND_API_TOKEN.length : 0
                }
            });
        }

    } catch (error) {
        console.error('Test error:', error);
        return res.json({ 
            success: false, 
            message: '❌ Test failed with exception',
            error: error.message 
        });
    }
});

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

        const configTest = await emailService.testConfiguration();
        if (!configTest) {
            req.flash('error_msg', 'Email service is currently unavailable. Please try again later.');
            return res.redirect('/users/forgot-password');
        }

        const user = await User.findOne({ email });

        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            user.resetPasswordToken = resetToken;
            user.resetPasswordExpires = Date.now() + 3600000;
            await user.save();

            const resetLink = `${req.protocol}://${req.get('host')}/users/reset-password/${resetToken}`;
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
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg')
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
 *  Profile & Favorites
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

router.post('/favorites/:hymnId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Please log in' });

    try {
        const user = await User.findById(req.session.user.id);
        const hymnId = req.params.hymnId;

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
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * =======================
 *  Update Profile & Change Password
 * =======================
 */
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

// Update Notification Preferences Route
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