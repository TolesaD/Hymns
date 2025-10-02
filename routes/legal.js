const express = require('express');
const router = express.Router();

// Terms of Service Route
router.get('/terms', (req, res) => {
    res.redirect('https://telegra.ph/Medlot-Terms-of-Service-10-02');
});

// Privacy Policy Route
router.get('/privacy', (req, res) => {
    res.redirect('https://telegra.ph/Medlot-Privacy-Policy-10-02');
});

module.exports = router;