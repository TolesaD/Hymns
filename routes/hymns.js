const express = require('express');
const Hymn = require('../models/Hymn');
const Comment = require('../models/Comment');
const router = express.Router();

// Hymn detail page
router.get('/:id', async (req, res) => {
    try {
        console.log('Fetching hymn with ID:', req.params.id);
        
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            console.log('Hymn not found for ID:', req.params.id);
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/');
        }
        
        console.log('Hymn found:', hymn.title);
        
        // Increment play count
        hymn.plays = (hymn.plays || 0) + 1;
        await hymn.save();
        console.log('Play count incremented to:', hymn.plays);
        
        // Get related hymns
        const relatedHymns = await Hymn.find({
            hymnLanguage: hymn.hymnLanguage,
            category: hymn.category,
            _id: { $ne: hymn._id }
        }).limit(4);
        
        console.log('Found related hymns:', relatedHymns.length);
        
        // Get current URL for social sharing
        const currentUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
        
        res.render('hymn-detail', {
            title: hymn.title,
            hymn: hymn,
            relatedHymns: relatedHymns || [],
            currentUrl: currentUrl
        });
        
    } catch (error) {
        console.error('Error loading hymn detail:', error);
        req.flash('error_msg', 'Error loading hymn: ' + error.message);
        res.redirect('/');
    }
});

// Download hymn
router.get('/:id/download', async (req, res) => {
    try {
        const hymn = await Hymn.findById(req.params.id);
        if (!hymn) {
            req.flash('error_msg', 'Hymn not found');
            return res.redirect('/');
        }
        
        // Increment download count
        hymn.downloads = (hymn.downloads || 0) + 1;
        await hymn.save();
        
        res.redirect(hymn.audioFile);
    } catch (error) {
        console.error('Error downloading hymn:', error);
        req.flash('error_msg', 'Error downloading hymn');
        res.redirect('/');
    }
});

module.exports = router;