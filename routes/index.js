const express = require('express');
const Hymn = require('../models/Hymn');
const router = express.Router();

// Home route with proper flash messages
router.get('/', async (req, res) => {
    try {
        console.log('🏠 Home page accessed - Flash messages:', {
            success: req.flash('success_msg'),
            error: req.flash('error_msg'),
            info: req.flash('info_msg')
        });

        // Get hymn statistics for each language
        const hymnData = {
            amharic: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 },
            oromo: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 },
            tigrigna: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 },
            english: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 }
        };

        // Get counts for each language and category
        const languages = ['amharic', 'oromo', 'tigrigna', 'english'];
        const categories = ['worship', 'praise', 'thanksgiving', 'slow'];

        for (const lang of languages) {
            for (const cat of categories) {
                const count = await Hymn.countDocuments({ 
                    hymnLanguage: lang, 
                    category: cat 
                });
                hymnData[lang][cat] = count;
                hymnData[lang].total += count;
            }
        }

        // Get featured hymns
        const featuredHymns = await Hymn.find({ featured: true })
            .sort({ createdAt: -1 })
            .limit(8);

        console.log('✅ Homepage data loaded successfully');

        res.render('index', {
            title: 'Ethiopian Orthodox Hymns',
            hymnData,
            featuredHymns,
            user: req.user || null,
            // Flash messages are automatically available via res.locals
        });

    } catch (error) {
        console.error('❌ Home route error:', error);
        req.flash('error_msg', 'Error loading homepage data');
        res.render('index', {
            title: 'Ethiopian Orthodox Hymns',
            hymnData: {
                amharic: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 },
                oromo: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 },
                tigrigna: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 },
                english: { worship: 0, praise: 0, thanksgiving: 0, slow: 0, total: 0 }
            },
            featuredHymns: [],
            user: req.user || null
        });
    }
});

// Language category routes
router.get('/:language/:category', async (req, res) => {
    try {
        const { language, category } = req.params;
        const validLanguages = ['amharic', 'oromo', 'tigrigna', 'english'];
        const validCategories = ['worship', 'praise', 'thanksgiving', 'slow'];

        if (!validLanguages.includes(language) || !validCategories.includes(category)) {
            req.flash('error_msg', 'Invalid language or category');
            return res.redirect('/');
        }

        const hymns = await Hymn.find({ 
            hymnLanguage: language, 
            category: category 
        }).sort({ title: 1 });

        const languageNames = {
            amharic: 'Amharic',
            oromo: 'Afan Oromo',
            tigrigna: 'Tigrigna',
            english: 'English'
        };

        const categoryNames = {
            worship: 'Worship',
            praise: 'Praise',
            thanksgiving: 'Thanksgiving',
            slow: 'Slow'
        };

        res.render('hymns-list', {
            title: `${languageNames[language]} ${categoryNames[category]} Hymns`,
            hymns,
            language: languageNames[language],
            category: categoryNames[category],
            user: req.user || null
        });

    } catch (error) {
        console.error('Language category error:', error);
        req.flash('error_msg', 'Error loading hymns');
        res.redirect('/');
    }
});

// Search route - FIXED: Use consistent variable name
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            req.flash('info_msg', 'Please enter a search term');
            return res.redirect('back');
        }

        const hymns = await Hymn.find({
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { lyrics: { $regex: q, $options: 'i' } }
            ]
        }).sort({ title: 1 });

        console.log(`🔍 Search for "${q}" found ${hymns.length} results`);

        res.render('search', {
            title: `Search Results for "${q}"`,
            hymns,
            query: q, // CHANGED FROM searchQuery TO query
            user: req.user || null,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            info_msg: req.flash('info_msg'),
            warning_msg: req.flash('warning_msg')
        });

    } catch (error) {
        console.error('Search error:', error);
        req.flash('error_msg', 'Error performing search');
        res.redirect('/');
    }
});

// =============================================
// NEW ROUTES FOR FOOTER PAGES
// =============================================

// Contact Page Route
router.get('/contact', (req, res) => {
    res.render('contact', {
        title: 'Contact Us - Akotet',
        user: req.user || null,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg'),
        info_msg: req.flash('info_msg')
    });
});

// About Page Route  
router.get('/about', (req, res) => {
    res.render('about', {
        title: 'About Akotet - Spiritual Hymns Service',
        user: req.user || null,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg'),
        info_msg: req.flash('info_msg')
    });
});

// Privacy Policy Route - Redirect to external Telegraph page
router.get('/privacy', (req, res) => {
    res.redirect('https://telegra.ph/Akotet-Privacy-Policy-10-03');
});

// Terms of Service Route - Redirect to external Telegraph page
router.get('/terms', (req, res) => {
    res.redirect('https://telegra.ph/Akotet-Terms-of-Service-10-03');
});

// Contact form submission handler (if you want to add form functionality later)
router.post('/contact', async (req, res) => {
    try {
        const { name, email, message, prayerRequest } = req.body;
        
        // Here you can add email sending logic using your emailService
        // For now, we'll just show a success message
        
        console.log('📧 Contact form submitted:', { name, email, prayerRequest: !!prayerRequest });
        
        req.flash('success_msg', 'Thank you for your message! We will respond you soon.');
        res.redirect('/contact');
        
    } catch (error) {
        console.error('Contact form error:', error);
        req.flash('error_msg', 'Error sending your message. Please try again or email us directly at akotetservice@gmail.com');
        res.redirect('/contact');
    }
});

module.exports = router;