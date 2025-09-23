const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const initAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hymns-app');
        
        // Check if admin user already exists
        const existingAdmin = await User.findOne({ username: 'Tolesa' });
        
        if (!existingAdmin) {
            // Create admin user
            const adminUser = new User({
                username: 'Tolesa',
                email: 'marosetofficial@gmail.com',
                password: 'tolesahymn123' // This will be hashed by the pre-save hook
            });
            
            await adminUser.save();
            console.log('Admin user created successfully');
        } else {
            console.log('Admin user already exists');
        }
        
        mongoose.connection.close();
    } catch (error) {
        console.error('Error initializing admin:', error);
        process.exit(1);
    }
};

initAdmin();