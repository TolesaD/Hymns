const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hymns_db';
    console.log('Attempting to connect to MongoDB at:', uri);
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      maxPoolSize: 10, // Allow up to 10 connections
    });
    console.log(`MongoDB Connected: ${conn.connection.host}:${conn.connection.port}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error('Ensure MongoDB is running on 127.0.0.1:27017');
    process.exit(1);
  }
};

module.exports = connectDB;