const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const app = express();

// Enhanced trust proxy for Vercel
app.set('trust proxy', 1);

// Database connection with correct options
const connectDB = async () => {
    try {
        console.log('🔍 Checking MONGODB_URI...');
        
        if (!process.env.MONGODB_URI) {
            console.error('❌ CRITICAL: MONGODB_URI is not defined in environment variables');
            console.log('📋 Available environment variables:', Object.keys(process.env));
            return false;
        }

        // Basic validation of MongoDB URI
        if (!process.env.MONGODB_URI.startsWith('mongodb')) {
            console.error('❌ INVALID MONGODB_URI: Does not start with mongodb:// or mongodb+srv://');
            return false;
        }

        console.log('🔗 Attempting MongoDB connection...');
        console.log('📝 MONGODB_URI starts with:', process.env.MONGODB_URI.substring(0, 50) + '...');
        
        // CORRECTED: Remove unsupported options
        const connectionOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            // Remove bufferMaxEntries as it's not supported
            retryWrites: true
        };

        await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
        
        console.log('✅ MongoDB connected successfully!');
        console.log('🏠 Host:', mongoose.connection.host);
        console.log('📊 Database:', mongoose.connection.name);
        return true;
        
    } catch (error) {
        console.error('❌ MongoDB connection FAILED:');
        console.error('💥 Error:', error.message);
        console.error('🔧 Error name:', error.name);
        
        if (error.name === 'MongoServerSelectionError') {
            console.error('🚨 This is a server selection error - check your MongoDB Atlas IP whitelist or network connectivity');
        } else if (error.name === 'MongoParseError') {
            console.error('🚨 This is a connection string parsing error - check your MONGODB_URI format');
        } else if (error.name === 'MongoNetworkError') {
            console.error('🚨 This is a network error - check your internet connection or MongoDB server status');
        }
        
        return false;
    }
};

// Initialize DB connection with retry logic
let dbConnectionAttempts = 0;
const maxConnectionAttempts = 3;

const initializeDB = async () => {
    while (dbConnectionAttempts < maxConnectionAttempts) {
        dbConnectionAttempts++;
        console.log(`🔄 Database connection attempt ${dbConnectionAttempts}/${maxConnectionAttempts}`);
        
        const connected = await connectDB();
        if (connected) {
            break;
        }
        
        if (dbConnectionAttempts < maxConnectionAttempts) {
            console.log(`⏳ Waiting 5 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

// Start DB initialization (don't await to avoid blocking server start)
initializeDB();

// MongoDB connection events for better debugging
mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 MongoDB disconnected - sessions will not work!');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔁 MongoDB reconnected');
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'models/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration with memory fallback
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: true,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60,
        autoRemove: 'native',
        crypto: {
            secret: process.env.SESSION_SECRET || 'dev-crypto-secret'
        }
    }),
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
};

// Handle session store errors
sessionConfig.store.on('error', (error) => {
    console.error('💥 Session store error:', error);
    console.log('⚠️ Sessions will not persist without MongoDB connection');
});

app.use(session(sessionConfig));

// Flash messages
app.use(flash());

// Global variables with DB status
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null;
    res.locals.dbConnected = mongoose.connection.readyState === 1;
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

// Enhanced Health check endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState];
    
    res.status(200).json({
        status: 'OK',
        server: 'running',
        database: {
            status: dbStatus,
            readyState: dbState,
            connectionAttempts: dbConnectionAttempts
        },
        environment: process.env.NODE_ENV || 'development',
        session: {
            id: req.sessionID,
            user: req.session.user ? 'logged_in' : 'anonymous'
        },
        timestamp: new Date().toISOString(),
        vercel: true
    });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({
                status: 'error',
                message: 'MongoDB is not connected',
                readyState: mongoose.connection.readyState
            });
        }

        // Try to ping the database
        await mongoose.connection.db.admin().ping();
        res.json({
            status: 'success',
            message: 'MongoDB is connected and responsive',
            connectionState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            database: mongoose.connection.name
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'MongoDB connection test failed',
            error: error.message,
            readyState: mongoose.connection.readyState
        });
    }
});

// Test session functionality
app.get('/api/session-test', (req, res) => {
    req.session.testValue = 'session_test_' + Date.now();
    req.session.testTime = new Date().toISOString();
    
    req.session.save((err) => {
        if (err) {
            return res.json({ 
                error: 'Session save failed', 
                details: err.message,
                sessionId: req.sessionID,
                dbConnected: mongoose.connection.readyState === 1
            });
        }
        
        res.json({
            message: 'Session test completed',
            sessionId: req.sessionID,
            testValue: req.session.testValue,
            testTime: req.session.testTime,
            dbConnected: mongoose.connection.readyState === 1,
            environment: process.env.NODE_ENV || 'development'
        });
    });
});

// 404 handler
app.use((req, res) => {
    console.log('❌ 404 - Route not found:', req.originalUrl);
    res.status(404).render('404', { 
        title: 'Page Not Found',
        user: req.session.user || null
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
        user: req.session.user || null
    });
});

const PORT = process.env.PORT || 3000;

// Export for Vercel
module.exports = app;