const express = require('express');
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const router = express.Router();

// Search suggestions API
router.get('/search-suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json([]);
        }

        const hymns = await Hymn.find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ]
        })
        .select('title hymnLanguage')
        .limit(10);

        res.json(hymns);
    } catch (error) {
        console.error('Search suggestions error:', error);
        res.status(500).json({ error: 'Error fetching suggestions' });
    }
});

// Newsletter subscription
router.post('/newsletter', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // For now, just return success
        // In a real app, you'd save to a newsletter database
        res.json({ 
            success: true, 
            message: 'Successfully subscribed to newsletter!' 
        });
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        res.status(500).json({ error: 'Subscription failed' });
    }
});

// Health check endpoint (duplicate from app.js for API consistency)
router.get('/health', (req, res) => {
    const dbStatus = require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        status: 'OK',
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;