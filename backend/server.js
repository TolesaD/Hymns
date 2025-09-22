const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hymns_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/img', express.static(path.join(__dirname, '../frontend/img')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Import and use routes with better error handling
const loadRoutes = (routePath, routeName) => {
  try {
    const routes = require(routePath);
    return routes;
  } catch (error) {
    console.error(`Error loading ${routeName} routes:`, error.message);
    // Return a basic router as fallback
    const router = express.Router();
    router.all('*', (req, res) => {
      res.status(501).json({
        status: 'error',
        message: `${routeName} routes temporarily unavailable`
      });
    });
    return router;
  }
};

app.use('/api/hymns', loadRoutes('./routes/hymns', 'hymns'));
app.use('/api/auth', loadRoutes('./routes/auth', 'auth'));
app.use('/api/categories', loadRoutes('./routes/categories', 'categories'));
app.use('/api/notifications', loadRoutes('./routes/notifications', 'notifications'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hymns_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log('Server started successfully');