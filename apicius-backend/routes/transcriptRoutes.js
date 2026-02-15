const express = require('express');
const router = express.Router();
const {
    extractYouTubeTranscript,
    convertTranscriptToRecipe,
    mapIngredientsToDatabase,
    getConversionHistory,
    getConversionDetails
} = require('../controllers/transcriptController');

// Route logging middleware
router.use((req, res, next) => {
    console.log(`📼 Transcript route accessed: ${req.method} ${req.url}`);
    next();
});

// __________-------------Transcript Extraction Routes-------------__________

// Extract YouTube transcript
router.post('/extract-youtube', extractYouTubeTranscript);

// Convert transcript to recipe using Groq LLM
router.post('/convert-to-recipe', convertTranscriptToRecipe);

// Map extracted ingredients to database
router.post('/map-ingredients', mapIngredientsToDatabase);

// __________-------------Debugging & History Routes-------------__________

// Get conversion history
router.get('/history', getConversionHistory);

// Get specific conversion details
router.get('/history/:id', getConversionDetails);

module.exports = router;