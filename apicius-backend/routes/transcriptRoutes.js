const express = require('express');
const router = express.Router();
const {
    extractYouTubeTranscript,
    convertTranscriptToRecipe,
    mapIngredientsToDatabase,
    getConversionHistory,
    getConversionDetails
} = require('../controllers/transcriptController');
const { saveRecipeFromVideo } = require('../controllers/recipeFromVideoController');

// Route logging middleware
router.use((req, res, next) => {
    console.log(`📼 Transcript route accessed: ${req.method} ${req.url}`);
    next();
});

// __________-------------Transcript Extraction Routes-------------__________
router.post('/extract-youtube', extractYouTubeTranscript);
router.post('/convert-to-recipe', convertTranscriptToRecipe);
router.post('/map-ingredients', mapIngredientsToDatabase);

// __________-------------Save Recipe from Video Conversion-------------__________
router.post('/save-recipe-from-video', saveRecipeFromVideo);

// __________-------------Debugging & History Routes-------------__________
router.get('/history', getConversionHistory);
router.get('/history/:id', getConversionDetails);

module.exports = router;