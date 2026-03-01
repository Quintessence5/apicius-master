const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const {extractRecipeFromYoutube} = require('../services/youtubeService');
const {extractRecipeFromTikTok} = require('../services/tikTokService');
const {saveRecipeFromVideo} = require('../controllers/videoRecipeController');
const {getConversionHistory, getConversionDetails} = require('../services/conversionLogger');
const { extractRecipeFromWebsiteHandler } = require('../controllers/websiteRecipeController');
const { extractRecipeFromInstagram } = require('../services/instagramService');
const { extractRecipeFromUrl } = require('../services/urlRecipeExtractor');
const { extractRecipeFromImageHandler } = require('../services/imageService');

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
router.post('/extract-instagram', extractRecipeFromInstagram);

// __________-------------Save recipe to database-------------__________
router.post('/save-recipe', saveRecipeFromVideo);

// __________-------------DB log saving-------------__________
router.get('/history', getConversionHistory);
router.get('/history/:id', getConversionDetails);

// __________-------------URL extract-------------__________
// New website endpoint
router.post('/extract-recipe-website', extractRecipeFromWebsiteHandler);

router.post('/extract-url', extractRecipeFromUrl);
router.post('/extract-from-image', upload.single('image'), extractRecipeFromImageHandler);

module.exports = router;