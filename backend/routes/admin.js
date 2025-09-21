const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Emergency admin password reset (remove this in production after use)
router.post('/emergency-reset', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        // Find the user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        // Update the password
        user.password = newPassword;
        await user.save();
        
        res.status(200).json({
            status: 'success',
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Emergency reset error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error resetting password'
        });
    }
});

module.exports = router;