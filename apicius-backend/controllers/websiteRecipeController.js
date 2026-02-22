const pool = require('../config/db');
const { extractRecipeFromWebsite } = require('../services/websiteRecipeService');
const { matchIngredientsWithDatabase } = require('./videoRecipeController');
const { logConversion, logConversionError } = require('../services/conversionLogger');
const { translateRecipeToEnglish, sanitizeRecipe } = require('../services/videoToRecipeService'); 

const extractRecipeFromWebsiteHandler = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { url, userId = null } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        console.log(`\n🌐 ========== EXTRACTING RECIPE FROM WEBSITE ==========`);
        console.log(`URL: ${url}`);

        // ----- Step 0: Check if this URL has been processed before -----
        const existingRecipeCheck = await pool.query(
            `SELECT r.id as recipe_id, r.title, tc.id as conversion_id
             FROM transcript_conversions tc
             LEFT JOIN recipes r ON tc.recipe_json->>'title' = r.title
             WHERE tc.source_url = $1 AND tc.status = 'recipe_generated'
             ORDER BY tc.created_at DESC LIMIT 1`,
            [url]
        );

        if (existingRecipeCheck.rows.length > 0 && existingRecipeCheck.rows[0].recipe_id) {
            console.log(`✅ Found existing recipe! ID: ${existingRecipeCheck.rows[0].recipe_id}`);
            return res.json({
                success: true,
                redirect: true,
                recipeId: existingRecipeCheck.rows[0].recipe_id,
                message: 'Recipe already exists for this URL',
                processingTime: Date.now() - startTime
            });
        }

        // ----- Step 1: Validate URL (basic) -----
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid URL format' });
        }

        // ----- Step 2: Extract recipe from website (service) -----
console.log('🌐 Step 2: Extracting recipe from website...');
const { recipe, imageUrl } = await extractRecipeFromWebsite(url);

// ----- Step 2.5: Translate recipe to English if needed -----
console.log('🌐 Step 2.5: Ensuring recipe is in English...');
let translatedRecipe = await translateRecipeToEnglish(recipe);
translatedRecipe = sanitizeRecipe(translatedRecipe); // re‑sanitize after translation

// ----- Defensive: ensure ingredients and steps are arrays -----
translatedRecipe.ingredients = Array.isArray(translatedRecipe.ingredients) ? translatedRecipe.ingredients : [];
translatedRecipe.steps = Array.isArray(translatedRecipe.steps) ? translatedRecipe.steps : [];

// ----- Step 3: Match ingredients with database -----
console.log('🌐 Step 3: Matching ingredients with database...');
let ingredientMatches;
try {
    ingredientMatches = await matchIngredientsWithDatabase(translatedRecipe.ingredients);
} catch (matchError) {
    console.warn('⚠️ Ingredient matching error (continuing):', matchError.message);
    ingredientMatches = {
        all: translatedRecipe.ingredients.map(ing => ({ ...ing, found: false })),
        matched: [],
        unmatched: translatedRecipe.ingredients,
        matchPercentage: 0,
    };
}

// ----- Step 4: Log conversion -----
console.log('🌐 Step 4: Logging conversion...');
conversionId = await logConversion({
    user_id: userId,
    source_type: 'website',
    source_url: url,
    video_title: translatedRecipe.title || 'Untitled',
    transcript_text: null,
    recipe_json: translatedRecipe,
    recipe_status: 'generated',
    status: 'recipe_generated',
    processing_time_ms: Date.now() - startTime,
});

console.log(`✅ Recipe extracted: "${translatedRecipe.title || 'Untitled'}"`);
console.log(`   Ingredients: ${translatedRecipe.ingredients.length}`);
console.log(`   Steps: ${translatedRecipe.steps.length}`);
console.log(`   Image: ${imageUrl || 'none'}`);

res.json({
    success: true,
    conversionId,
    recipe: translatedRecipe,
    ingredientMatches,
    sourceTitle: translatedRecipe.title,
    sourceUrl: url,
    videoThumbnail: imageUrl,
    processingTime: Date.now() - startTime,
    message: '✅ Recipe extracted from website successfully!',
});

    } catch (error) {
        console.error('❌ Website extraction error:', error);

        if (conversionId) {
            await logConversionError(conversionId, 'WebsiteExtractionError', error.message, 'extraction');
        }

        res.status(500).json({
            success: false,
            conversionId,
            message: 'Failed to extract recipe from website',
            error: error.message,
        });
    }
};

module.exports = { extractRecipeFromWebsiteHandler };