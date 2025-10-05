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
        req.flash('info_msg', 'You are already logged in');
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
            console.log('❌ Registration validation errors:', errors.array());
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
            console.log('❌ User already exists:', { email, username });
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

        console.log('✅ User registered successfully:', username);
        
        req.flash('success_msg', `🎉 Welcome to Hymns, ${username}! Your account has been created successfully. You can now log in.`);
        
        return res.redirect('/users/login');

    } catch (error) {
        console.error('❌ Registration error:', error);
        req.flash('error_msg', '❌ Server error during registration. Please try again.');
        return res.redirect('/users/register');
    }
});

// Login Routes
router.get('/login', (req, res) => {
    if (req.user) {
        req.flash('info_msg', 'You are already logged in');
        return res.redirect('/');
    }
    
    // Read possible query params from logout or redirects
    const successFromQuery = req.query.success;
    const errorFromQuery = req.query.error;
    const infoFromQuery = req.query.info;
    const warningFromQuery = req.query.warning;
    
    console.log('🔍 Login page - Query parameters:', {
        success: successFromQuery,
        error: errorFromQuery,
        info: infoFromQuery,
        warning: warningFromQuery
    });
    
    // If query params exist, set them as flash messages
    if (successFromQuery) {
        req.flash('success_msg', decodeURIComponent(successFromQuery));
        console.log('✅ Set flash from query - success:', decodeURIComponent(successFromQuery));
    }
    if (errorFromQuery) {
        req.flash('error_msg', decodeURIComponent(errorFromQuery));
        console.log('✅ Set flash from query - error:', decodeURIComponent(errorFromQuery));
    }
    if (infoFromQuery) {
        req.flash('info_msg', decodeURIComponent(infoFromQuery));
        console.log('✅ Set flash from query - info:', decodeURIComponent(infoFromQuery));
    }
    if (warningFromQuery) {
        req.flash('warning_msg', decodeURIComponent(warningFromQuery));
        console.log('✅ Set flash from query - warning:', decodeURIComponent(warningFromQuery));
    }
    
    // Get the flash messages after setting them
    const success_msg = req.flash('success_msg');
    const error_msg = req.flash('error_msg');
    const info_msg = req.flash('info_msg');
    const warning_msg = req.flash('warning_msg');
    
    console.log('🔍 Login page - Final flash messages:', {
        success: success_msg,
        error: error_msg,
        info: info_msg,
        warning: warning_msg
    });
    
    res.render('login', { 
        title: 'Login',
        errors: [],
        email: '',
        success_msg: success_msg.length > 0 ? success_msg : null,
        error_msg: error_msg.length > 0 ? error_msg : null,
        info_msg: info_msg.length > 0 ? info_msg : null,
        warning_msg: warning_msg.length > 0 ? warning_msg : null
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
            console.log('❌ Login validation errors:', errors.array());
            return res.render('login', {
                title: 'Login',
                errors: errors.array(),
                email: req.body.email || '',
                success_msg: null,
                error_msg: null,
                info_msg: null,
                warning_msg: null
            });
        }

        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        
        const user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            console.log('❌ User not found:', normalizedEmail);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || '',
                success_msg: null,
                error_msg: null,
                info_msg: null,
                warning_msg: null
            });
        }

        if (user.isBlocked) {
            console.log('❌ Blocked user attempt:', user.username);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Your account has been blocked. Please contact support.' }],
                email: req.body.email || '',
                success_msg: null,
                error_msg: null,
                info_msg: null,
                warning_msg: null
            });
        }

        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            console.log('❌ Password mismatch for:', user.username);
            return res.render('login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email: req.body.email || '',
                success_msg: null,
                error_msg: null,
                info_msg: null,
                warning_msg: null
            });
        }

        // STRICT: Only Tolesa with marosetofficial@gmail.com is admin
        const isTolesa = user.username === 'Tolesa';
        const isCorrectEmail = user.email === 'marosetofficial@gmail.com';
        const isAdmin = isTolesa && isCorrectEmail && user.isAdmin === true;

        // Set session data
        req.session.user = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            isAdmin: isAdmin
        };

        console.log('✅ Login successful:', user.username, 'Admin:', isAdmin);

        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.render('login', {
                    title: 'Login',
                    errors: [{ msg: 'Login error. Please try again.' }],
                    email: req.body.email || '',
                    success_msg: null,
                    error_msg: null,
                    info_msg: null,
                    warning_msg: null
                });
            }

            console.log('✅ Session saved successfully');
            
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
        req.flash('error_msg', 'Server error during login. Please try again.');
        return res.redirect('/users/login');
    }
});

// Logout Route
router.get('/logout', (req, res) => {
    const username = req.user ? req.user.username : 'Unknown user';
    console.log('👋 Logout requested by:', username);
    
    // Store user info before destroying session
    const userName = req.user ? req.user.username : 'User';
    const isAdmin = req.user ? req.user.isAdmin : false;
    
    // Set flash message BEFORE destroying session
    if (isAdmin) {
        req.flash('success_msg', `👋 Admin ${userName} has been logged out successfully.`);
    } else {
        req.flash('success_msg', `👋 ${userName} has been logged out successfully. Come back soon!`);
    }
    
    console.log('💾 Flash message set:', req.flash('success_msg')[0]);
    
    // Destroy session
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Session destruction error:', err);
            // Even if session destruction fails, redirect to login
            return res.redirect('/users/login');
        }
        
        // Clear the cookie
        res.clearCookie('connect.sid');
        console.log('✅ Logout completed for:', userName);
        console.log('🔀 Redirecting to login page');
        
        // Redirect to login - the flash message should persist
        res.redirect('/users/login');
    });
});

// Forgot Password Routes
router.get('/forgot-password', (req, res) => {
    if (req.user) {
        req.flash('info_msg', 'You are already logged in');
        return res.redirect('/');
    }
    
    res.render('forgot-password', {
        title: 'Forgot Password - Akotet Hymns',
        user: req.user || null
    });
});

// Forgot Password POST Route
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        console.log('🔐 Password reset requested for:', email);

        if (!email) {
            req.flash('error_msg', 'Please enter your email address');
            return res.redirect('/users/forgot-password');
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        
        // Always show success message for security (don't reveal if email exists)
        if (!user) {
            console.log('❌ No user found with email:', email);
            req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
            return res.redirect('/users/login');
        }

        console.log('✅ User found:', user.email);

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour

        // Save token to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save();

        console.log('✅ Reset token generated and saved for user:', user.email);

        // Create reset link
        const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/users/reset-password?token=${resetToken}`;
        
        console.log('📧 Sending password reset email...');
        console.log('Reset Link:', resetLink);

        // Send email using your existing service
        const emailSent = await emailService.sendPasswordResetEmail(
            user.email,
            resetToken,
            resetLink
        );

        if (emailSent) {
            console.log('✅ Password reset email sent successfully to:', user.email);
            req.flash('success_msg', 'Password reset link has been sent to your email. Check your inbox (and spam folder).');
        } else {
            console.error('❌ Failed to send password reset email to:', user.email);
            req.flash('error_msg', 'Failed to send reset email. Please try again or contact support.');
        }

        res.redirect('/users/login');

    } catch (error) {
        console.error('❌ Forgot password error:', error);
        req.flash('error_msg', 'An error occurred. Please try again.');
        res.redirect('/users/forgot-password');
    }
});

// Reset Password GET Route
router.get('/reset-password', async (req, res) => {
    try {
        const { token } = req.query;
        
        console.log('🔐 Reset password page accessed with token:', token ? 'present' : 'missing');

        if (!token) {
            req.flash('error_msg', 'Invalid reset token');
            return res.redirect('/users/login');
        }

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.log('❌ Invalid or expired reset token');
            req.flash('error_msg', 'Password reset token is invalid or has expired');
            return res.redirect('/users/login');
        }

        console.log('✅ Valid reset token for user:', user.email);

        res.render('reset-password', {
            title: 'Reset Password - Akotet Hymns',
            token,
            user: req.user || null
        });

    } catch (error) {
        console.error('❌ Reset password page error:', error);
        req.flash('error_msg', 'An error occurred. Please try again.');
        res.redirect('/users/login');
    }
});

// Reset Password POST Route
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;
        
        console.log('🔐 Processing password reset with token:', token ? 'present' : 'missing');

        if (!token || !password || !confirmPassword) {
            req.flash('error_msg', 'Please fill in all fields');
            return res.redirect(`/users/reset-password?token=${token}`);
        }

        if (password !== confirmPassword) {
            req.flash('error_msg', 'Passwords do not match');
            return res.redirect(`/users/reset-password?token=${token}`);
        }

        if (password.length < 6) {
            req.flash('error_msg', 'Password must be at least 6 characters long');
            return res.redirect(`/users/reset-password?token=${token}`);
        }

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.log('❌ Invalid or expired reset token during password reset');
            req.flash('error_msg', 'Password reset token is invalid or has expired');
            return res.redirect('/users/login');
        }

        console.log('✅ Valid user found for password reset:', user.email);

        // Hash new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Update user and clear reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        console.log('✅ Password successfully reset for user:', user.email);

        req.flash('success_msg', 'Your password has been reset successfully. You can now log in with your new password.');
        res.redirect('/users/login');

    } catch (error) {
        console.error('❌ Password reset error:', error);
        req.flash('error_msg', 'An error occurred while resetting your password. Please try again.');
        res.redirect('/users/login');
    }
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
            user: user
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

// Update Settings Route (Language Preferences)
router.post('/update-settings', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { languagePreference } = req.body;
        
        console.log('🔄 Updating user settings for:', req.user.username);
        console.log('🌍 Language preference:', languagePreference);

        // Validate language preference
        const validLanguages = ['english', 'amharic', 'oromo', 'tigrigna'];
        if (languagePreference && !validLanguages.includes(languagePreference)) {
            return res.status(400).json({ error: 'Invalid language preference' });
        }

        // Update user settings
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { 
                languagePreference: languagePreference || 'english'
            },
            { new: true }
        );

        // Update session if needed
        if (req.session.user) {
            req.session.user.languagePreference = user.languagePreference;
        }

        console.log('✅ Settings updated successfully for:', user.username);
        res.json({ 
            message: 'Settings updated successfully',
            languagePreference: user.languagePreference 
        });
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        res.status(500).json({ error: 'Error updating settings: ' + error.message });
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

// Test Email Route (Remove in production)
router.get('/test-email', async (req, res) => {
    if (process.env.NODE_ENV !== 'production') {
        const testEmail = req.query.email || 'test@example.com';
        console.log('🧪 Testing email service with:', testEmail);
        
        const result = await emailService.sendTestEmail(testEmail);
        
        if (result) {
            req.flash('success_msg', `Test email sent successfully to ${testEmail}`);
        } else {
            req.flash('error_msg', 'Failed to send test email. Check console for details.');
        }
    } else {
        req.flash('error_msg', 'Test email feature disabled in production');
    }
    
    res.redirect('/');
});

module.exports = router;