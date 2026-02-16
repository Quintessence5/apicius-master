const express = require('express');
const router = express.Router();
const {
    convertTranscriptToRecipe,
    mapIngredientsToDatabase,
    getConversionHistory,
    getConversionDetails
} = require('../controllers/transcriptController');
const { extractYouTubeRecipeHybrid } = require('../controllers/hybridVideoController');
const { saveRecipeFromVideo } = require('../controllers/recipeFromVideoController');

// Route logging middleware
router.use((req, res, next) => {
    console.log(`📼 Transcript route accessed: ${req.method} ${req.url}`);
    next();
});

// __________-------------NEW: Hybrid YouTube Extraction (Description + Audio Fallback)-------------__________
router.post('/extract-youtube', extractYouTubeRecipeHybrid);

// __________-------------Existing Routes (still available)-------------__________
router.post('/convert-to-recipe', convertTranscriptToRecipe);
router.post('/map-ingredients', mapIngredientsToDatabase);
router.post('/save-recipe-from-video', saveRecipeFromVideo);

// __________-------------History Routes-------------__________
router.get('/history', getConversionHistory);
router.get('/history/:id', getConversionDetails);

module.exports = router;