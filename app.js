const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const app = express();

// Trust proxy for Vercel (production)
app.set('trust proxy', 1);

// Database connection with better error handling
const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI is not defined');
            return;
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
    }
};

connectDB();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

// FIXED: Serve static files from multiple directories
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'models/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration - DIFFERENT FOR LOCAL vs PRODUCTION
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'hymns-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Auto true on Vercel
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
};

app.use(session(sessionConfig));

// Flash messages
app.use(flash());

// Custom authentication middleware to convert session.user to req.user
app.use((req, res, next) => {
    // Convert session user to req.user for consistency
    if (req.session.user) {
        req.user = req.session.user;
    }
    next();
});

// Global variables for templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.user || null; // Now using req.user consistently
    next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/hymns', require('./routes/hymns'));
app.use('/admin', require('./routes/admin'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        status: 'OK',
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development',
        session: req.user ? 'active' : 'none',
        timestamp: new Date().toISOString()
    });
});

// Debug session endpoint
app.get('/api/debug-session', (req, res) => {
    res.json({
        sessionId: req.sessionID,
        sessionUser: req.session.user,
        reqUser: req.user,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Test route to check if server is working
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is working!',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Test routes endpoint
app.get('/test-routes', (req, res) => {
    res.json({
        message: 'Routes test',
        workingRoutes: [
            '/',
            '/test',
            '/api/health',
            '/api/debug-session',
            '/test-routes',
            '/users/login',
            '/users/register',
            '/admin/dashboard'
        ],
        timestamp: new Date().toISOString()
    });
});

// 404 handler - MUST BE AFTER ALL ROUTES
app.use((req, res) => {
    console.log('❌ 404 - Route not found:', req.originalUrl);
    res.status(404).render('404', { 
        title: 'Page Not Found',
        user: req.user || null // Fixed to use req.user
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Server Error:', err.stack);
    res.status(500).render('error', {
        title: 'Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong! Please try again later.' 
            : err.message,
        user: req.user || null // Fixed to use req.user
    });
});

const PORT = process.env.PORT || 3000;

// Export for Vercel, but also listen locally
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📱 Local: http://localhost:${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔐 Session secure: ${process.env.NODE_ENV === 'production'}`);
    });
}

module.exports = app;