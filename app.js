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
  if (!isDBConnected) {
    await connectDB();
    isDBConnected = true;
  }
};

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration for Vercel
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

// Only use MongoStore if MongoDB URI is available
if (MONGODB_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 14 * 24 * 60 * 60,
    autoRemove: 'native'
  });
} else {
  console.warn('⚠️  MONGODB_URI not set, using memory session store');
}

app.use(session(sessionConfig));

// Flash messages
app.use(flash());

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
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working!',
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
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
  
  // Log full error in development
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

// Export the app for Vercel
module.exports = app;