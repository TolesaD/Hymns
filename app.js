const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Vercel-specific configuration
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🚀 Initializing app...');
console.log('Environment:', {
  isVercel,
  nodeEnv: process.env.NODE_ENV,
  hasMongoURI: !!MONGODB_URI
});

// MongoDB connection with Vercel optimization
let mongooseConnection = null;

const connectDB = async () => {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    return null;
  }

  try {
    // Reuse existing connection if available
    if (mongoose.connection.readyState === 1) {
      console.log('✅ Using existing MongoDB connection');
      return mongoose.connection;
    }

    // Close any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    console.log('🔌 Connecting to MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      bufferCommands: false, // Critical for serverless
      bufferMaxEntries: 0,   // Critical for serverless
    });
    
    console.log('✅ MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return null;
  }
};

// Trust proxy for Vercel
if (isVercel) {
  app.set('trust proxy', 1);
  console.log('🔒 Trust proxy enabled for Vercel');
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// VERCEL-OPTIMIZED SESSION CONFIGURATION
const sessionConfig = {
  name: 'hymns.sid',
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: isVercel, // HTTPS only on Vercel
    sameSite: isVercel ? 'none' : 'lax',
  }
};

// Only add store if MongoDB is available
if (MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 14 * 24 * 60 * 60,
    autoRemove: 'interval',
    autoRemoveInterval: 10,
    crypto: {
      secret: process.env.SESSION_SECRET || 'fallback-secret'
    },
    collectionName: 'sessions'
  });
}

app.use(session(sessionConfig));

// Flash messages
app.use(flash());

// Enhanced request logging for Vercel
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('📊 Request:', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: duration + 'ms',
      sessionId: req.sessionID ? req.sessionID.substring(0, 8) + '...' : 'none',
      hasUser: !!req.session.user
    });
  });
  
  next();
});

// Initialize database before routes
app.use(async (req, res, next) => {
  try {
    if (!mongooseConnection && MONGODB_URI) {
      mongooseConnection = await connectDB();
    }
    next();
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    next(error);
  }
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

// Health check (no session dependency)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV,
    vercel: isVercel,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Session debug endpoint
app.get('/debug', (req, res) => {
  if (!req.session.visits) req.session.visits = 0;
  req.session.visits++;
  
  res.json({
    session: {
      id: req.sessionID,
      visits: req.session.visits,
      user: req.session.user,
      cookie: req.session.cookie
    },
    headers: {
      host: req.get('host'),
      'user-agent': req.get('user-agent')?.substring(0, 50)
    }
  });
});

// Test login endpoint
app.get('/test-login', (req, res) => {
  req.session.user = {
    id: 'test-' + Date.now(),
    username: 'testuser',
    email: 'test@example.com',
    isAdmin: false
  };
  
  req.session.save((err) => {
    if (err) {
      return res.json({ error: err.message });
    }
    res.json({ 
      message: 'Test login successful',
      user: req.session.user,
      sessionId: req.sessionID 
    });
  });
});

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/hymns', require('./routes/hymns'));
app.use('/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found',
    user: req.session.user || null
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.message);
  if (!isVercel) {
    console.error('Stack:', err.stack);
  }
  
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong! Please try again later.',
    user: req.session.user || null
  });
});

// Export for Vercel
if (isVercel) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`📍 Server running on http://localhost:${PORT}`);
    console.log(`🔧 Mode: ${isVercel ? 'Production' : 'Development'}`);
  });
}