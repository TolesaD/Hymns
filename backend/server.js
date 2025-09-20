const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads/audio', express.static(path.join('/tmp', 'Uploads', 'audio')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hymns_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Database connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Apply JSON parsing only to specific routes that need it
app.use('/api/auth', express.json({ limit: '10mb' }));
app.use('/api/categories', express.json({ limit: '10mb' }));
app.use('/api/users', express.json({ limit: '10mb' }));
app.use('/api/contact', express.json({ limit: '10mb' }));

// For hymn routes, handle multipart/form-data separately
app.use('/api/hymns', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/hymns', require('./routes/hymns'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/users', require('./routes/users'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/notifications', require('./routes/notifications'));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('All active sessions cleared. Users will need to login again.');
});