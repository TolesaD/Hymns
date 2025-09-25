const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();

// ----------------------
// MongoDB Connection
// ----------------------
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hymns-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    bufferCommands: false,
    bufferMaxEntries: 0
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
});

// Trust proxy for Vercel
app.set('trust proxy', 1);

// ----------------------
// Middleware
// ----------------------
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------
// Session Configuration
// ----------------------
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/hymns-app',
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native',
        crypto: {
            secret: process.env.SESSION_SECRET || 'fallback-secret'
        }
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
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

// ----------------------
// Multer 2.x Setup
// ----------------------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio or image files are allowed!'), false);
        }
    }
});

// Make Multer available in routes via app.locals
app.locals.upload = upload;

// ----------------------
// View Engine
// ----------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ----------------------
// Debug Middleware
// ----------------------
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Session ID:', req.sessionID);
    console.log('Session User:', req.session.user);
    next();
});

// ----------------------
// Routes
// ----------------------
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/hymns', require('./routes/hymns'));
app.use('/admin', require('./routes/admin'));

// ----------------------
// Health Check
// ----------------------
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

// ----------------------
// Debug Environment Variables
// ----------------------
app.get('/debug-env', (req, res) => {
    res.json({
        NODE_ENV: process.env.NODE_ENV,
        APP_URL: process.env.APP_URL,
        MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
        SESSION_SECRET: process.env.SESSION_SECRET ? 'Set' : 'Not set',
        MAILERSEND_API_TOKEN: process.env.MAILERSEND_API_TOKEN ? 'Set' : 'Not set',
        B2_KEY_ID: process.env.B2_KEY_ID ? 'Set' : 'Not set'
    });
});

// ----------------------
// 404 Handler
// ----------------------
app.use((req, res) => {
    console.log('404 Error - Route not found:', req.url);
    res.status(404).render('404', {
        title: 'Page Not Found',
        user: req.session.user || null
    });
});

// ----------------------
// Error Handler
// ----------------------
app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', err.stack);
    req.flash('error_msg', err.message);
    res.status(500).render('error', {
        title: 'Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'Something went wrong. Please try again later.'
            : err.message,
        user: req.session.user || null
    });
});

// ----------------------
// Server / Vercel Export
// ----------------------
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
    module.exports = app; // for Vercel serverless
} else {
    app.listen(PORT, () => {
        console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
        console.log(`📍 Debug env: http://localhost:${PORT}/debug-env`);
    });
}
