const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Enhanced MongoDB connection
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
    });
    
    console.log('✅ MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return null;
  }
};

// Initialize DB connection
let isDBConnected = false;

const initializeApp = async () => {
  if (!isDBConnected && MONGODB_URI) {
    await connectDB();
    isDBConnected = true;
  }
};

// Trust proxy for Vercel (only in production)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  console.log('🔒 Production mode: Trust proxy enabled');
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced Session configuration for both local and production
const isProduction = process.env.NODE_ENV === 'production';
const sessionConfig = {
  name: 'hymns.sid',
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax', // Adjust for local vs production
  }
};

// Set domain only in production
if (isProduction) {
  sessionConfig.cookie.domain = '.vercel.app';
}

// Use MongoStore if MongoDB URI is available, otherwise memory store for local dev
if (MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 14 * 24 * 60 * 60,
    autoRemove: 'native',
    crypto: {
      secret: process.env.SESSION_SECRET || 'fallback-secret'
    },
    collectionName: 'sessions'
  });
  console.log('💾 Using MongoDB session store');
} else {
  console.warn('⚠️  MONGODB_URI not set, using memory session store (sessions will not persist)');
}

app.use(session(sessionConfig));

// Flash messages
app.use(flash());

// Debug middleware for sessions (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    // Log session info for auth-related routes
    if (req.path.includes('/login') || req.path.includes('/admin') || req.path.includes('/debug')) {
      console.log('🔍 SESSION DEBUG:', {
        path: req.path,
        sessionId: req.sessionID ? req.sessionID.substring(0, 10) + '...' : 'none',
        hasUser: !!req.session.user,
        user: req.session.user ? { 
          username: req.session.user.username,
          isAdmin: req.session.user.isAdmin 
        } : null,
        headers: {
          cookie: req.headers.cookie ? 'present' : 'missing',
          host: req.get('host')
        }
      });
    }
    next();
  });
}

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

// Initialize app on first request
app.use(async (req, res, next) => {
  await initializeApp();
  next();
});

// Debug endpoints (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug-session', (req, res) => {
    if (!req.session.visitCount) {
      req.session.visitCount = 0;
    }
    req.session.visitCount++;
    
    res.json({
      session: {
        id: req.sessionID,
        visitCount: req.session.visitCount,
        user: req.session.user || null,
        createdAt: req.session.createdAt || new Date().toISOString()
      },
      cookies: req.headers.cookie || 'No cookies',
      secure: req.secure,
      host: req.get('host'),
      appUrl: process.env.APP_URL,
      nodeEnv: process.env.NODE_ENV
    });
  });

  app.get('/debug-login', (req, res) => {
    req.session.user = {
      id: 'debug-user-id',
      username: 'debuguser',
      email: 'debug@test.com',
      isAdmin: true
    };
    
    req.session.save((err) => {
      if (err) {
        return res.json({ error: 'Session save failed', details: err.message });
      }
      
      res.json({
        message: 'Debug login successful',
        user: req.session.user,
        sessionId: req.sessionID,
        instructions: 'Now visit /debug-session to check if session persists'
      });
    });
  });
}

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/hymns', require('./routes/hymns'));
app.use('/admin', require('./routes/admin'));

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    session: {
      id: req.sessionID ? req.sessionID.substring(0, 10) + '...' : 'none',
      user: req.session.user ? 'logged_in' : 'anonymous'
    },
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working!',
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    sessionId: req.sessionID ? req.sessionID.substring(0, 10) + '...' : 'none'
  });
});

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
  
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(500).render('error', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong! Please try again later.' 
      : err.message,
    user: req.session.user || null
  });
});

// Start server locally, export for Vercel
if (process.env.NODE_ENV === 'production') {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}