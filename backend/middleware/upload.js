const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Set storage for audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/audio/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for audio files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only MP3 and WAV files are allowed'), false);
  }
};

// Multer configuration
const uploadAudio = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      status: 'error',
      message: `Upload error: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
  next();
};

module.exports = { uploadAudio, handleUploadError };