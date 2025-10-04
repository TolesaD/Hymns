const express = require('express');
const router = express.Router();

// Terms of Service Route
router.get('/terms', (req, res) => {
    res.redirect('https://telegra.ph/Akotet-Terms-of-Service-10-03');
});

// Privacy Policy Route
router.get('/privacy', (req, res) => {
    res.redirect('https://telegra.ph/Akotet-Privacy-Policy-10-03');
});

module.exports = router;