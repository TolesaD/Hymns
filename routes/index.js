const express = require('express'); 
const Hymn = require('../models/Hymn');
const router = express.Router();

// Homepage
router.get('/', async (req, res) => {
    try {
        const featuredHymns = await Hymn.find({ featured: true }).limit(6);
        const languages = ['amharic', 'oromo', 'tigrigna', 'english'];
        const categories = ['worship', 'praise', 'thanksgiving', 'slow'];
        
        // Get actual hymn counts from database using hymnLanguage field
        const hymnData = {
            amharic: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 },
            oromo: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 },
            tigrigna: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 },
            english: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 }
        };
        
        // Fetch actual counts from database
        for (let lang of languages) {
            for (let cat of categories) {
                try {
                    const count = await Hymn.countDocuments({ 
                        hymnLanguage: lang,  // Changed from language to hymnLanguage
                        category: cat 
                    });
                    hymnData[lang][cat] = count;
                    console.log(`Count for ${lang} ${cat}: ${count}`); // Debug log
                } catch (error) {
                    console.error(`Error counting ${lang} ${cat}:`, error);
                    hymnData[lang][cat] = 0;
                }
            }
        }
        
        res.render('index', {
            title: 'Home - Ethiopian Orthodox Hymns',
            featuredHymns,
            hymnData,
            languages,
            categories
        });
    } catch (error) {
        console.error('Homepage error:', error);
        res.render('index', {
            title: 'Home - Ethiopian Orthodox Hymns',
            featuredHymns: [],
            hymnData: {
                amharic: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 },
                oromo: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 },
                tigrigna: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 },
                english: { worship: 0, praise: 0, thanksgiving: 0, slow: 0 }
            },
            languages: ['amharic', 'oromo', 'tigrigna', 'english'],
            categories: ['worship', 'praise', 'thanksgiving', 'slow']
        });
    }
});

// Search functionality
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.redirect('/');
        }
        
        let hymns = [];
        try {
            hymns = await Hymn.find({
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ]
            }).limit(20);
        } catch (error) {
            console.log('No search results found');
        }
        
        res.render('search', {
            title: `Search Results for "${query}"`,
            hymns: hymns || [],
            query
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error performing search');
        res.redirect('/');
    }
});

// Newsletter subscription API
router.post('/api/newsletter', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        console.log('Newsletter subscription:', email);
        res.json({ message: 'Successfully subscribed to newsletter' });
        
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search suggestions API
router.get('/api/search-suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json([]);
        }
        
        let suggestions = [];
        try {
            suggestions = await Hymn.find({
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ]
            })
            .select('title hymnLanguage _id')
            .limit(5);
        } catch (error) {
            console.log('No search suggestions found');
        }
        
        res.json(suggestions || []);
    } catch (error) {
        console.error('Search suggestions error:', error);
        res.json([]);
    }
});

// Language/Category page
router.get('/:language/:category', async (req, res, next) => {
    const { language, category } = req.params;
    
    // Only handle valid languages and categories
    const validLanguages = ['amharic', 'oromo', 'tigrigna', 'english'];
    const validCategories = ['worship', 'praise', 'thanksgiving', 'slow'];
    
    if (!validLanguages.includes(language) || !validCategories.includes(category)) {
        return next(); // Pass to 404 handler
    }
    
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        
        const hymns = await Hymn.find({ 
            hymnLanguage: language,  // Changed from language to hymnLanguage
            category: category 
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
        
        const total = await Hymn.countDocuments({ 
            hymnLanguage: language,  // Changed from language to hymnLanguage
            category: category 
        });
        
        const totalPages = Math.ceil(total / limit);
        
        res.render('hymns-list', {
            title: `${language.charAt(0).toUpperCase() + language.slice(1)} ${category.charAt(0).toUpperCase() + category.slice(1)} Hymns`,
            hymns,
            language,
            category,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading hymns');
        res.redirect('/');
    }
});
module.exports = router;