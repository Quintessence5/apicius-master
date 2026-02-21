const express = require('express');
const router = express.Router();
const {extractRecipeFromYoutube} = require('../services/youtubeService');
const {extractRecipeFromTikTok} = require('../services/tikTokService');
const {saveRecipeFromVideo} = require('../controllers/videoRecipeController');
const {getConversionHistory, getConversionDetails} = require('../services/conversionLogger');
const { extractRecipeFromURL } = require('../services/recipeScraperService');

// Route logging
router.use((req, res, next) => {
    console.log(`📼 Transcript route: ${req.method} ${req.url}`);
    next();
});
router.use((req, res, next) => {
  console.log(`🌐 Recipe Scraper route: ${req.method} ${req.url}`);
  next();
});

// __________-------------Main Endpoint: Extract recipe from YouTube video description-------------__________
router.post('/extract-youtube', extractRecipeFromYoutube);
router.post('/extract-tiktok', extractRecipeFromTikTok);

// __________-------------Save recipe to database-------------__________
router.post('/save-recipe', saveRecipeFromVideo);

// __________-------------DB log saving-------------__________
router.get('/history', getConversionHistory);
router.get('/history/:id', getConversionDetails);

// __________-------------URL extract-------------__________
router.post('/extract', extractRecipeFromURL);

module.exports = router;