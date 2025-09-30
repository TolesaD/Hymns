const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const initAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hymns-app');
        
        console.log('🔧 Initializing single admin user...');
        
        // Remove any duplicate admin users
        const duplicateUsers = await User.find({
            $or: [
                { username: 'Tolesaa' },
                { email: 'tolesadebushe9@gmail.com' }
            ]
        });
        
        if (duplicateUsers.length > 0) {
            for (const user of duplicateUsers) {
                await User.deleteOne({ _id: user._id });
                console.log(`🗑️ Removed duplicate user: ${user.username} (${user.email})`);
            }
        }
        
        // Create/update the single correct Tolesa user
        let tolesaUser = await User.findOne({ username: 'Tolesa' });
        if (!tolesaUser) {
            console.log('➕ Creating Tolesa admin user...');
            tolesaUser = new User({
                username: 'Tolesa',
                email: 'marosetofficial@gmail.com',
                password: 'tolesahymn123',
                isAdmin: true
            });
            await tolesaUser.save();
            console.log('✅ Tolesa admin user created');
        } else {
            // Ensure correct credentials
            tolesaUser.email = 'marosetofficial@gmail.com';
            tolesaUser.isAdmin = true;
            await tolesaUser.save();
            console.log('✅ Tolesa admin user verified');
        }
        
        // Verify single admin
        const adminUsers = await User.find({ isAdmin: true });
        console.log('\n👑 Admin users count:', adminUsers.length);
        adminUsers.forEach(user => {
            console.log(`   - ${user.username} (${user.email})`);
        });
        
        mongoose.connection.close();
        console.log('\n✅ Single admin initialization completed');
        
    } catch (error) {
        console.error('❌ Error initializing admin:', error);
        process.exit(1);
    }
};

initAdmin();