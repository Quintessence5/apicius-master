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
router.post('/extract', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required',
      });
    }
    
    const result = await extractRecipeFromURL(url);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error in recipe scraper endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during recipe extraction',
      error: error.message,
    });
  }
});

module.exports = router;