// app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
require('dotenv').config();
const connectToDatabase = require('./utils/mongodb');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60,
        autoRemove: 'native',
        crypto: {
            secret: process.env.SESSION_SECRET || 'fallback-secret'
        }
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined
    }
}));

// Flash messages
app.use(flash());

// Global template variables
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null;
    res.locals.currentUrl = req.originalUrl;
    next();
});

// Debug middleware (optional)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/hymns', require('./routes/hymns'));
app.use('/admin', require('./routes/admin'));

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        session: {
            id: req.sessionID,
            user: req.session.user
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        user: req.session.user || null
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', err.stack);
    res.status(500).render('error', {
        title: 'Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'Something went wrong. Please try again later.'
            : err.message,
        user: req.session.user || null
    });
});

// **Serverless Export for Vercel**
module.exports = async (req, res) => {
    try {
        // Connect to MongoDB (cached)
        await connectToDatabase(process.env.MONGODB_URI);
        // Pass request to Express app
        app(req, res);
    } catch (err) {
        console.error('🚨 Serverless Function Error:', err);
        res.status(500).send('Internal Server Error');
    }
};

// **Local development**
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    connectToDatabase(process.env.MONGODB_URI).then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    }).catch(err => console.error('❌ MongoDB connection error:', err));
}
