// services/imageService.js
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { extractRecipeFromImage } = require('./utils/imageExtractor');
const { matchIngredientsWithDatabase } = require('../controllers/videoRecipeController');
const { completeMissingMetadata, sanitizeRecipe } = require('./videoToRecipeService');
const { logConversion, logConversionError } = require('./conversionLogger');

const UPLOAD_TEMP_DIR = path.join(__dirname, '../uploads/temp');
const UPLOAD_RECIPE_DIR = path.join(__dirname, '../uploads/recipe');


async function extractRecipeFromImageHandler(req, res) {
  const startTime = Date.now();
  let conversionId = null;
  let tempFilePath = null;
  let permanentFilePath = null;

  try {
    // 1. Validate file
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const file = req.file;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Only JPG, PNG, and WEBP images are allowed' });
    }

    // 2. Save file temporarily
    await fs.mkdir(UPLOAD_TEMP_DIR, { recursive: true });
    const tempFilename = `${crypto.randomUUID()}_${file.originalname}`;
    tempFilePath = path.join(UPLOAD_TEMP_DIR, tempFilename);
    await fs.writeFile(tempFilePath, file.buffer); // if using multer memory storage

    console.log(`📸 Image saved temporarily: ${tempFilePath}`);

    // 3. Extract recipe using vision / OCR
    const rawRecipe = await extractRecipeFromImage(tempFilePath, file.mimetype);
    if (!rawRecipe) {
      throw new Error('Could not extract recipe from image');
    }

    // 4. Sanitize recipe (ensure structure)
    let recipe = sanitizeRecipe(rawRecipe);

    // 5. Match ingredients with database
    let ingredientMatches;
    try {
      ingredientMatches = await matchIngredientsWithDatabase(recipe.ingredients || []);
    } catch (matchError) {
      console.warn('⚠️ Ingredient matching error:', matchError.message);
      ingredientMatches = {
        all: (recipe.ingredients || []).map(ing => ({ ...ing, dbId: null, found: false, icon: '⚠️' })),
        matched: [],
        unmatched: recipe.ingredients || [],
        matchPercentage: 0,
      };
    }

    // 6. Complete missing metadata
    // For images we don't have a rich text source, but we can pass the raw recipe as combined text
    const combinedText = JSON.stringify(rawRecipe); // crude, but works
    recipe = await completeMissingMetadata(recipe, combinedText, recipe.title || 'Image Recipe');

    // Validate that we actually got a recipe
    function isValidRecipe(recipe) {
      const hasTitle = recipe.title && recipe.title.trim().length > 0;
      const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;
      const hasSteps = recipe.steps && recipe.steps.length > 0;
      return hasTitle && (hasIngredients || hasSteps);
    }

    if (!isValidRecipe(recipe)) {
      throw new Error('No recipe could be extracted from the image. Please try a clearer image.');
    } 

    // 7. Move image to permanent location (recipe thumbnails)
    await fs.mkdir(UPLOAD_RECIPE_DIR, { recursive: true });
    const permanentFilename = `${crypto.randomUUID()}_${file.originalname}`;
    permanentFilePath = path.join(UPLOAD_RECIPE_DIR, permanentFilename);
    await fs.rename(tempFilePath, permanentFilePath);
    tempFilePath = null; // avoid deletion later
    const relativeImagePath = permanentFilePath.replace(path.join(__dirname, '..'), '');

    // Attach image path to recipe (for saving later)
    recipe.image_path = relativeImagePath;

    // 8. Log conversion
    conversionId = await logConversion({
      user_id: req.body.userId || null,
      source_type: 'image',
      source_url: null,
      video_title: recipe.title || 'Image Recipe',
      transcript_text: null, // no transcript for image
      recipe_json: recipe,
      recipe_status: 'generated',
      status: 'recipe_generated',
      processing_time_ms: Date.now() - startTime,
    });

    console.log(`✅ Image conversion logged: ${conversionId}`);

    // 9. Return success
    res.json({
      success: true,
      conversionId,
      recipe,
      ingredientMatches,
      videoTitle: recipe.title || 'Image Recipe',
      videoThumbnail: relativeImagePath, // for frontend preview
      processingTime: Date.now() - startTime,
      message: '✅ Recipe extracted from image successfully!',
    });

  } catch (error) {
    console.error('❌ Image extraction error:', error);

    if (conversionId) {
      await logConversionError(conversionId, 'CriticalError', error.message, 'extraction');
    }

    // Clean up temp file if still present
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }

    res.status(500).json({
      success: false,
      conversionId,
      message: error.message || 'Failed to extract recipe from image',
    });
  }
}

module.exports = { extractRecipeFromImageHandler };