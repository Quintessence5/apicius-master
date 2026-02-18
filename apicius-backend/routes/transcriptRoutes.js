const express = require('express');
const router = express.Router();
const {
    extractRecipeFromVideo,
    saveRecipeFromVideo
} = require('../controllers/videoRecipeController');
const {
    getConversionHistory,
    getConversionDetails
} = require('../controllers/transcriptController');

// Route logging
router.use((req, res, next) => {
    console.log(`📼 Transcript route: ${req.method} ${req.url}`);
    next();
});

// __________-------------Main Endpoint: Extract recipe from YouTube video description-------------__________
router.post('/extract-youtube', extractRecipeFromVideo);

// __________-------------Save recipe to database-------------__________
router.post('/save-recipe', saveRecipeFromVideo);

// __________-------------Keep existing endpoints for compatibility-------------__________
router.get('/history', getConversionHistory);
router.get('/history/:id', getConversionDetails);

module.exports = router;