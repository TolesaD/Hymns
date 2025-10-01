const express = require('express');
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const Hymn = require('../models/Hymn');
const emailService = require('../services/emailService');

const router = express.Router();

// Register Routes
router.get('/register', (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }
    res.render('register', { 
        title: 'Create Account',
        errors: [],
        username: '',
        email: '',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
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
                email: req.body.email || '',
                success_msg: req.flash('success_msg'),
                error_msg: req.flash('error_msg')
            });
        }

        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });

        if (existingUser) {
            return res.render('register', {
                title: 'Create Account',
                errors: [{ msg: 'User already exists with this email or username' }],
                username: req.body.username || '',
                email: req.body.email || '',
                success_msg: req.flash('success_msg'),
                error_msg: req.flash('error_msg')
            });
        }

        const user = new User({ 
            username, 
            email, 
            password,
            isSubscribed: req.body.newsletter === 'on'
        });
        await user.save();

        req.flash('success_msg', 'Registration successful! You can now log in.');
        res.redirect('/users/login');
    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error_msg', 'Server error during registration. Please try again.');
        res.redirect('/users/register');
    }
});

// Login Routes
router.get('/login', (req, res) => {
    if (req.user) {
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
                email: req.body.email || '',
                success_msg: req.flash('success_msg'),
                error_msg: req.flash('error_msg')
            });
        }

        const { email, password } = req.body;
        
        // Better email normalization
        const normalizedEmail = email.toLowerCase().trim();
        console.log('📧 Normalized email:', normalizedEmail);
        
        const user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            console.log('❌ User not found:', normalizedEmail);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || '',
                success_msg: req.flash('success_msg'),
                error_msg: req.flash('error_msg')
            });
        }

        // Check if user is blocked
if (user.isBlocked) {
    console.log('❌ Blocked user attempt:', user.username);
    return res.render('login', {
        title: 'Login',
        errors: [{ msg: 'Your account has been blocked. Please contact support.' }],
        email: req.body.email || '',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
}

        console.log('👤 User found:', user.username);
        console.log('🔍 Admin status - Username:', user.username, 'isAdmin flag:', user.isAdmin);

        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            console.log('❌ Password mismatch for:', user.username);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || '',
                success_msg: req.flash('success_msg'),
                error_msg: req.flash('error_msg')
            });
        }

        // STRICT: Only Tolesa with marosetofficial@gmail.com is admin
        const isTolesa = user.username === 'Tolesa';
        const isCorrectEmail = user.email === 'marosetofficial@gmail.com';
        const isAdmin = isTolesa && isCorrectEmail && user.isAdmin === true;
        
        console.log('🔍 STRICT Admin check:', {
            username: user.username,
            isTolesa: isTolesa,
            email: user.email,
            isCorrectEmail: isCorrectEmail,
            isAdminFlag: user.isAdmin,
            finalIsAdmin: isAdmin
        });

        console.log('✅ Login successful:', user.username, 'Admin:', isAdmin);

        // Set session data
        req.session.user = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            isAdmin: isAdmin
        };

        console.log('💾 Session data set:', req.session.user);

        // Use session save with callback for better reliability
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.render('login', {
                    title: 'Login',
                    errors: [{ msg: 'Login error. Please try again.' }],
                    email: req.body.email || '',
                    success_msg: req.flash('success_msg'),
                    error_msg: req.flash('error_msg')
                });
            }

            console.log('✅ Session saved successfully');
            console.log('🔍 Final session check:', req.session.user);
            
            req.flash('success_msg', `Welcome back, ${user.username}!`);
            
            if (isAdmin) {
                console.log('➡️ Redirecting to admin dashboard');
                return res.redirect('/admin/dashboard');
            } else {
                console.log('➡️ Redirecting to homepage');
                return res.redirect('/');
            }
        });

    } catch (error) {
        console.error('💥 CRITICAL Login error:', error);
        console.error('💥 Error stack:', error.stack);
        
        let errorMessage = 'Server error during login';
        
        if (error.name === 'MongoError') {
            errorMessage = 'Database connection error. Please try again.';
        } else if (error.name === 'ValidationError') {
            errorMessage = 'Data validation error. Please check your input.';
        } else if (error.message && error.message.includes('bcrypt')) {
            errorMessage = 'Password processing error. Please try again.';
        }
        
        return res.render('login', {
            title: 'Login',
            errors: [{ msg: errorMessage }],
            email: req.body.email || '',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
});

// Debug admin route
router.get('/debug-admin', async (req, res) => {
    try {
        const testEmail = 'marosetofficial@gmail.com';
        const user = await User.findOne({ email: testEmail });
        
        if (user) {
            const isTolesa = user.username === 'Tolesa';
            const isCorrectEmail = user.email === 'marosetofficial@gmail.com';
            const isAdmin = isTolesa && isCorrectEmail && user.isAdmin === true;
            
            res.json({
                userFound: true,
                username: user.username,
                email: user.email,
                isAdmin: isAdmin,
                isAdminFlag: user.isAdmin,
                isTolesa: user.username === 'Tolesa',
                computedAdminStatus: isAdmin,
                sessionUser: req.session.user,
                reqUser: req.user
            });
        } else {
            res.json({ userFound: false, message: 'Admin user not found' });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Logout Route
router.get('/logout', (req, res) => {
    const username = req.user ? req.user.username : 'Unknown user';
    console.log('👋 Logout requested by:', username);
    
    req.flash('success_msg', 'You have been logged out successfully.');
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/users/login');
    });
});

// Profile Route
router.get('/profile', async (req, res) => {
    console.log('👤 Profile access attempt - User:', req.user);
    
    if (!req.user) {
        console.log('❌ No user - redirecting to login');
        req.flash('error_msg', 'Please log in to view your profile');
        return res.redirect('/users/login');
    }

    try {
        const user = await User.findById(req.user.id).populate('favorites');
        if (!user) {
            console.log('❌ User not found in database');
            req.session.destroy();
            req.flash('error_msg', 'User not found. Please log in again.');
            return res.redirect('/users/login');
        }

        console.log('✅ Profile loaded for:', user.username);
        res.render('profile', {
            title: 'My Profile',
            user: user,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('Profile error:', error);
        req.flash('error_msg', 'Error loading profile');
        res.redirect('/');
    }
});

// Favorites Route
router.post('/favorites/:hymnId', async (req, res) => {
    console.log('❤️ Favorites request - User:', req.user);
    
    if (!req.user) {
        return res.status(401).json({ error: 'Please log in' });
    }

    try {
        const user = await User.findById(req.user.id);
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

// Forgot Password Routes
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
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
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
            // Don't reveal that email doesn't exist for security
        }

        // Always show success message for security
        req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
        res.redirect('/users/login');

    } catch (error) {
        console.error('Forgot password error:', error);
        req.flash('error_msg', 'Error processing request. Please try again.');
        res.redirect('/users/forgot-password');
    }
});

// Reset Password Routes
router.get('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or has expired.');
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
        req.flash('error_msg', 'Error processing reset password token.');
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
            req.flash('error_msg', 'Password reset token is invalid or has expired.');
            return res.redirect('/users/forgot-password');
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash('success_msg', 'Your password has been reset successfully. You can now log in.');
        res.redirect('/users/login');
    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error_msg', 'Error resetting password. Please try again.');
        res.redirect(`/users/reset-password/${req.params.token}`);
    }
});

// Update Profile Route
router.post('/update-profile', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

        const { username, email, fullName } = req.body;
        const existingUser = await User.findOne({ username, _id: { $ne: req.user.id } });

        if (existingUser) return res.status(400).json({ error: 'Username already taken' });

        const user = await User.findByIdAndUpdate(
            req.user.id,
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

// Change Password Route
router.post('/change-password', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

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

// Update Notifications Route
router.post('/update-notifications', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

        const { newsletter } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
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