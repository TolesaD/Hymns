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

// Middleware - CRITICAL ORDER
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'models/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'hymns-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60
    }),
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
};

app.use(session(sessionConfig));

// Flash middleware - MUST BE RIGHT AFTER SESSION
app.use(flash());

// CRITICAL FIX: Enhanced flash middleware with better handling
app.use((req, res, next) => {
    // Store ALL flash messages in res.locals for templates
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.info_msg = req.flash('info_msg');
    res.locals.warning_msg = req.flash('warning_msg');
    
    // For backward compatibility, also set first message
    res.locals.success = req.flash('success_msg')[0] || '';
    res.locals.error = req.flash('error_msg')[0] || '';
    res.locals.info = req.flash('info_msg')[0] || '';
    res.locals.warning = req.flash('warning_msg')[0] || '';
    
    // Convert session user to req.user for consistency
    if (req.session.user) {
        req.user = req.session.user;
    }
    res.locals.user = req.user || null;
    
    // Debug logging for flash messages
    if (res.locals.success_msg.length > 0 || res.locals.error_msg.length > 0 || res.locals.info_msg.length > 0) {
        console.log('🔍 FLASH MESSAGES SET:', {
            success: res.locals.success_msg,
            error: res.locals.error_msg,
            info: res.locals.info_msg,
            warning: res.locals.warning_msg
        });
    }
    
    next();
});

// Add this to your app.js or server.js
app.get('/debug-session', (req, res) => {
    res.json({
        session: req.session,
        user: req.user,
        flash: req.flash()
    });
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// =============================================
// CORRECTED ROUTES ORDER - FIXED!
// =============================================

// Routes - SPECIFIC ROUTES FIRST
app.use('/users', require('./routes/users'));
app.use('/admin', require('./routes/admin'));
app.use('/hymns', require('./routes/hymns'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/api'));

// MAIN ROUTES - MUST COME BEFORE LEGAL ROUTES
app.use('/', require('./routes/index')); // This contains /contact, /about routes

// LEGAL ROUTES LAST (only if they don't conflict with main routes)
app.use('/', require('./routes/legal'));

// =============================================

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

// 404 handler
app.use((req, res) => {
    console.log('❌ 404 - Route not found:', req.originalUrl);
    res.status(404).render('404', { 
        title: 'Page Not Found',
        user: req.user || null
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
        user: req.user || null
    });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📱 Local: http://localhost:${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = app;