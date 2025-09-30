const mongoose = require('mongoose');

const hymnSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        minlength: [2, 'Title must be at least 2 characters long'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters long'],
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    hymnLanguage: {
        type: String,
        required: [true, 'Language is required'],
        enum: {
            values: ['amharic', 'oromo', 'tigrigna', 'english'],
            message: 'Language must be: amharic, oromo, tigrigna, or english'
        }
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: {
            values: ['worship', 'praise', 'thanksgiving', 'slow'],
            message: 'Category must be: worship, praise, thanksgiving, or slow'
        }
    },
    audioFile: {
        type: String,
        required: [true, 'Audio file URL is required']
    },
    supabaseFilePath: {
        type: String, // Store the file path for deletion
        required: false
    },
    lyrics: {
        type: String,
        required: [true, 'Lyrics are required'],
        trim: true,
        minlength: [10, 'Lyrics must be at least 10 characters long']
    },
    duration: {
        type: Number,
        default: 0,
        min: [0, 'Duration cannot be negative']
    },
    plays: {
        type: Number,
        default: 0,
        min: [0, 'Plays cannot be negative']
    },
    downloads: {
        type: Number,
        default: 0,
        min: [0, 'Downloads cannot be negative']
    },
    rating: {
        type: Number,
        default: 0,
        min: [0, 'Rating cannot be less than 0'],
        max: [5, 'Rating cannot exceed 5']
    },
    ratingCount: {
        type: Number,
        default: 0,
        min: [0, 'Rating count cannot be negative']
    },
    featured: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    autoIndex: false
});

// Indexes
hymnSchema.index({ hymnLanguage: 1, category: 1 });
hymnSchema.index({ featured: 1 });
hymnSchema.index({ createdAt: -1 });
hymnSchema.index({ title: 1 });
hymnSchema.index({ description: 1 });

module.exports = mongoose.model('Hymn', hymnSchema);