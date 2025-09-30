const express = require('express');
const multer = require('multer');
const supabase = require('../supabaseClient');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /upload
router.post('/', upload.single('hymn'), async (req, res) => {
  try {
    const { originalname, buffer } = req.file;

    // Upload to Supabase bucket
    const { data, error } = await supabase.storage
      .from('hymns')
      .upload(`uploads/${Date.now()}-${originalname}`, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'audio/mpeg'
      });

    if (error) throw error;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('hymns')
      .getPublicUrl(data.path);

    res.json({ 
      message: 'Upload successful',
      url: publicUrlData.publicUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;