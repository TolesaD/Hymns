const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure storage for audio files
const uploadDir = path.join('/tmp', 'uploads', 'audio'); // Use /tmp for Render
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Create directory if it doesn't exist
}

const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Save to /tmp/uploads/audio/
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter for audio files
const audioFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an audio file! Please upload only audio files.'), false);
  }
};

// Create multer instance for audio uploads
exports.uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

// Error handling middleware for multer
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size is 20MB.',
      });
    }
    return res.status(400).json({
      status: 'error',
      message: `Multer error: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message,
    });
  }
  next();
};