const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Enhanced MongoDB connection for Vercel
const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    return null;
  }

  try {
    // Close existing connection if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false, // Important for serverless
      bufferMaxEntries: 0,   // Important for serverless
    });
    
    console.log('✅ MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return null;
  }
};

// Initialize DB connection on cold start
let isDBConnected = false;

const initializeApp = async () => {
  if (!isDBConnected && MONGODB_URI) {
    console.log('🔌 Initializing database connection...');
    await connectDB();
    isDBConnected = true;
  }
};

// Trust proxy for Vercel (CRITICAL)
app.set('trust proxy', 1);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// VERCEL-SPECIFIC SESSION CONFIGURATION
const isProduction = process.env.NODE_ENV === 'production';
console.log(`🚀 Starting in ${isProduction ? 'production' : 'development'} mode`);

const sessionConfig = {
  name: 'hymns.sid',
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MONGODB_URI ? MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'interval',
    autoRemoveInterval: 10, // Minutes
    crypto: {
      secret: process.env.SESSION_SECRET || 'fallback-secret'
    },
    collectionName: 'sessions',
    stringify: false // Important for serverless
  }) : undefined,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax',
    domain: isProduction ? '.vercel.app' : undefined
  }
};

// Log session configuration
console.log('🔐 Session configuration:', {
  hasStore: !!sessionConfig.store,
  cookieSecure: sessionConfig.cookie.secure,
  cookieSameSite: sessionConfig.cookie.sameSite,
  cookieDomain: sessionConfig.cookie.domain
});

app.use(session(sessionConfig));

// Flash messages
app.use(flash());

// Enhanced debug middleware
app.use((req, res, next) => {
  // Log all requests in production for debugging
  if (isProduction) {
    console.log('🌐 Request:', {
      method: req.method,
      path: req.path,
      sessionId: req.sessionID ? req.sessionID.substring(0, 10) + '...' : 'none',
      hasUser: !!req.session.user,
      ip: req.ip,
      host: req.get('host')
    });
  }
  next();
});

// Global variables for templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize app on first request (Vercel serverless compatible)
app.use(async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (error) {
    console.error('❌ App initialization error:', error);
    next(error);
  }
});

// Simple health check (no session dependency)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

// Session test endpoint
app.get('/session-test', (req, res) => {
  if (!req.session.visitCount) {
    req.session.visitCount = 0;
  }
  req.session.visitCount++;
  
  res.json({
    session: {
      id: req.sessionID,
      visitCount: req.session.visitCount,
      user: req.session.user || null,
    },
    cookies: req.headers.cookie || 'No cookies',
    secure: req.secure,
    host: req.get('host')
  });
});

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/hymns', require('./routes/hymns'));
app.use('/admin', require('./routes/admin'));

// Root route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'Ethiopian Orthodox Hymns',
    user: req.session.user || null
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
  console.error('🚨 Server Error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong! Please try again later.',
    user: req.session.user || null
  });
});

// Export the app for Vercel
module.exports = app;