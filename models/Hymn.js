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
        required: [true, 'Audio file URL is required'],
        validate: {
            validator: function(v) {
                return v.startsWith('http') || v.startsWith('https');
            },
            message: 'Audio file must be a valid URL'
        }
    },
    supabaseFilePath: {
        type: String,
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
        max: [5, 'Rating cannot exceed 5'],
        set: function(v) {
            return parseFloat(v.toFixed(1)); // Always store with 1 decimal
        }
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
    lastCommented: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
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
hymnSchema.index({ rating: -1 });
hymnSchema.index({ plays: -1 });
hymnSchema.index({ downloads: -1 });

// Pre-save middleware
hymnSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for formatted rating
hymnSchema.virtual('formattedRating').get(function() {
    return this.rating > 0 ? this.rating.toFixed(1) : 'No ratings';
});

// Virtual for star display
hymnSchema.virtual('starRating').get(function() {
    if (this.rating === 0) return '★★★★★';
    
    const fullStars = Math.floor(this.rating);
    const halfStar = this.rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
});

// Virtual for language display name
hymnSchema.virtual('languageName').get(function() {
    const names = {
        'amharic': 'Amharic',
        'oromo': 'Afan Oromo', 
        'tigrigna': 'Tigrigna',
        'english': 'English'
    };
    return names[this.hymnLanguage] || this.hymnLanguage;
});

// Virtual for category display name
hymnSchema.virtual('categoryName').get(function() {
    const names = {
        'worship': 'Worship',
        'praise': 'Praise',
        'thanksgiving': 'Thanksgiving',
        'slow': 'Slow'
    };
    return names[this.category] || this.category;
});

// Static method to get popular hymns
hymnSchema.statics.getPopular = function(limit = 10) {
    return this.find({ plays: { $gt: 0 } })
        .sort({ plays: -1, rating: -1 })
        .limit(limit);
};

// Static method to get highly rated hymns
hymnSchema.statics.getHighlyRated = function(limit = 10) {
    return this.find({ rating: { $gte: 4 }, ratingCount: { $gte: 3 } })
        .sort({ rating: -1, ratingCount: -1 })
        .limit(limit);
};

// Static method to get hymns by language and category with stats
hymnSchema.statics.getByLanguageAndCategory = function(language, category) {
    return this.find({ hymnLanguage: language, category: category })
        .sort({ title: 1 });
};

// Instance method to increment plays
hymnSchema.methods.incrementPlay = async function() {
    this.plays += 1;
    return this.save();
};

// Instance method to increment downloads
hymnSchema.methods.incrementDownload = async function() {
    this.downloads += 1;
    return this.save();
};

// Set virtuals to true when converting to JSON
hymnSchema.set('toJSON', { virtuals: true });
hymnSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Hymn', hymnSchema);