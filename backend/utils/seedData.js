const mongoose = require('mongoose');
const Category = require('../models/Category');
const Hymn = require('../models/Hymn');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Sample categories data
const categoriesData = [
  {
    name: 'Worship',
    description: 'Hymns dedicated to the worship of God and His majesty'
  },
  {
    name: 'Praise',
    description: 'Songs of praise and thanksgiving to the Lord'
  },
  {
    name: 'Thanksgiving',
    description: 'Hymns expressing gratitude for God\'s blessings'
  },
  {
    name: 'Lament',
    description: 'Songs expressing sorrow, grief, and petition to God'
  },
  {
    name: 'Festal',
    description: 'Hymns for special feast days and celebrations'
  },
  {
    name: 'Sacramental',
    description: 'Hymns for sacraments and holy rituals'
  }
];

// Sample hymns data
const hymnsData = [
  {
    title: 'Amazing Grace',
    description: 'A beloved Christian hymn about redemption and God\'s grace',
    lyrics: 'Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see',
    audioUrl: '/uploads/audio/amazing-grace.mp3',
    language: 'English',
    category: null, // Will be populated with actual category ID
    downloads: 0,
    listens: 0
  },
  {
    title: 'Teri Voroditz',
    description: 'A beautiful Armenian hymn for communion',
    lyrics: 'Armenian lyrics here...',
    audioUrl: '/uploads/audio/teri-voroditz.mp3',
    language: 'Armenian',
    category: null,
    downloads: 0,
    listens: 0
  },
  {
    title: 'Svete Tikhiy',
    description: 'A traditional Russian Orthodox evening hymn',
    lyrics: 'Russian lyrics here...',
    audioUrl: '/uploads/audio/svete-tikhiy.mp3',
    language: 'Russian',
    category: null,
    downloads: 0,
    listens: 0
  }
];

// Admin user data
const adminUser = {
  username: 'admin',
  email: 'tolesadebushe9@gmail.com',
  password: 'admin123',
  role: 'admin'
};

// Seed database with initial data
const seedDatabase = async () => {
  try {
    console.log('Seeding database...');
    
    // Clear existing data
    await Category.deleteMany({});
    await Hymn.deleteMany({});
    await User.deleteMany({});
    
    // Create categories
    const createdCategories = await Category.create(categoriesData);
    console.log(`${createdCategories.length} categories created`);
    
    // Update hymns with category IDs
    const worshipCategory = createdCategories.find(cat => cat.name === 'Worship');
    const praiseCategory = createdCategories.find(cat => cat.name === 'Praise');
    const sacramentalCategory = createdCategories.find(cat => cat.name === 'Sacramental');
    
    hymnsData[0].category = worshipCategory._id;
    hymnsData[1].category = sacramentalCategory._id;
    hymnsData[2].category = praiseCategory._id;
    
    // Create hymns
    const createdHymns = await Hymn.create(hymnsData);
    console.log(`${createdHymns.length} hymns created`);
    
    // Create admin user
    adminUser.password = await bcrypt.hash(adminUser.password, 12);
    const createdUser = await User.create(adminUser);
    console.log('Admin user created:', createdUser.email);
    
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

// Export the seed function
module.exports = seedDatabase;

// Run seeding if this file is executed directly
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/database');
  
  connectDB().then(() => {
    seedDatabase().then(() => {
      mongoose.connection.close();
    });
  });
}