const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // ADD THIS
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const app = express();

// Trust proxy for Vercel - ADD THIS
app.set('trust proxy', 1);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hymns-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// FIXED Session configuration for Vercel
app.use(session({
    secret: process.env.SESSION_SECRET || 'hymns-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ // ADD THIS FOR PERSISTENT SESSIONS
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Auto true on Vercel
        sameSite: 'lax'
    }
}));

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

// Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/hymns', require('./routes/hymns'));
app.use('/admin', require('./routes/admin'));

// 404 handler - MUST BE AFTER ALL ROUTES
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Server Error',
        message: 'Something went wrong!'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});