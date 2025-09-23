const mongoose = require('mongoose');
require('dotenv').config();

const fixIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hymns-app');
        console.log('Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        for (let collectionInfo of collections) {
            const collectionName = collectionInfo.name;
            console.log(`Checking collection: ${collectionName}`);
            
            const collection = db.collection(collectionName);
            const indexes = await collection.getIndexes();
            
            for (let indexName in indexes) {
                const index = indexes[indexName];
                // Check if this is a text index with language override
                if (index.textIndexVersion) {
                    console.log(`Found text index: ${indexName}`);
                    console.log('Index details:', JSON.stringify(index, null, 2));
                    
                    // Check if it has language override
                    if (index.weights) {
                        for (let field in index.weights) {
                            if (index.weights[field] !== 1) {
                                console.log(`Dropping problematic index: ${indexName}`);
                                await collection.dropIndex(indexName);
                                console.log(`Index ${indexName} dropped successfully`);
                            }
                        }
                    }
                }
            }
        }
        
        console.log('Index fix completed');
        mongoose.connection.close();
    } catch (error) {
        console.error('Error fixing indexes:', error);
        process.exit(1);
    }
};

fixIndexes();