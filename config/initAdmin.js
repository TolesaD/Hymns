const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const initAdmin = async () => {
    try {
        console.log('🔧 Starting admin initialization...');
        
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI is not defined in environment variables');
            process.exit(1);
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected successfully');
        
        // Clean up any duplicate admin users first
        console.log('🧹 Cleaning up duplicate users...');
        const duplicateUsers = await User.find({
            $or: [
                { username: 'Tolesa' },
                { email: 'marosetofficial@gmail.com' }
            ]
        });
        
        if (duplicateUsers.length > 1) {
            console.log(`🗑️ Found ${duplicateUsers.length} duplicate users, removing extras...`);
            // Keep the first one, delete the rest
            for (let i = 1; i < duplicateUsers.length; i++) {
                await User.deleteOne({ _id: duplicateUsers[i]._id });
                console.log(`🗑️ Removed duplicate user: ${duplicateUsers[i].username} (${duplicateUsers[i].email})`);
            }
        }
        
        // Create or update the single correct Tolesa user
        let tolesaUser = await User.findOne({ 
            username: 'Tolesa',
            email: 'marosetofficial@gmail.com'
        });
        
        if (!tolesaUser) {
            console.log('➕ Creating Tolesa admin user...');
            tolesaUser = new User({
                username: 'Tolesa',
                email: 'marosetofficial@gmail.com',
                password: 'tolesahymn123',
                isAdmin: true
            });
            await tolesaUser.save();
            console.log('✅ Tolesa admin user created successfully');
        } else {
            // Ensure correct credentials and admin status
            console.log('🔄 Updating existing Tolesa user...');
            tolesaUser.isAdmin = true;
            tolesaUser.password = 'tolesahymn123'; // Ensure password is set
            await tolesaUser.save();
            console.log('✅ Tolesa admin user updated and verified');
        }
        
        // Verify the admin user
        const finalUser = await User.findOne({ 
            username: 'Tolesa',
            email: 'marosetofficial@gmail.com'
        });
        
        if (finalUser) {
            console.log('\n👑 FINAL ADMIN USER VERIFICATION:');
            console.log(`   ✅ Username: ${finalUser.username}`);
            console.log(`   ✅ Email: ${finalUser.email}`);
            console.log(`   ✅ Admin Status: ${finalUser.isAdmin}`);
            console.log(`   ✅ User ID: ${finalUser._id}`);
            
            // Test password verification
            const isPasswordCorrect = await finalUser.comparePassword('tolesahymn123');
            console.log(`   ✅ Password Verification: ${isPasswordCorrect ? 'SUCCESS' : 'FAILED'}`);
        } else {
            console.log('❌ CRITICAL: Admin user not found after creation!');
        }
        
        // Count total admin users
        const adminUsers = await User.find({ isAdmin: true });
        console.log(`\n📊 Total admin users in system: ${adminUsers.length}`);
        
        if (adminUsers.length > 1) {
            console.log('⚠️  WARNING: Multiple admin users found:');
            adminUsers.forEach(user => {
                console.log(`   - ${user.username} (${user.email}) - Admin: ${user.isAdmin}`);
            });
        }
        
        await mongoose.connection.close();
        console.log('\n🎉 Admin initialization completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error initializing admin:', error);
        console.error('💥 Error details:', error.message);
        process.exit(1);
    }
};

// Handle script execution
if (require.main === module) {
    initAdmin();
}

module.exports = initAdmin;