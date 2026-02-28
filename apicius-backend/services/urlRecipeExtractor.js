// services/urlRecipeExtractor.js
const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('../config/db');
const {sanitizeRecipe} = require('./videoToRecipeService');
const {extractRecipeSimple, generateRecipeFromWebsiteText} = require('./utils/urlExtractor');
const {
    matchIngredientsWithDatabase
} = require('../controllers/videoRecipeController');
const { logConversion, logConversionError } = require('./conversionLogger');
const { completeMissingMetadata } = require('./videoToRecipeService');

// ---------- Helper: Normalize vulgar fractions to decimals ----------
function normalizeFractions(text) {
    const fractionMap = {
        '½': '0.5', '⅓': '0.333', '⅔': '0.667',
        '¼': '0.25', '¾': '0.75', '⅕': '0.2',
        '⅖': '0.4', '⅗': '0.6', '⅘': '0.8',
        '⅙': '0.167', '⅚': '0.833', '⅛': '0.125',
        '⅜': '0.375', '⅝': '0.625', '⅞': '0.875'
    };
    
    // First handle mixed numbers like "1 ⅓" -> "1.333"
    let normalized = text.replace(/(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (match, whole, fraction) => {
        const decimal = fractionMap[fraction] || '0';
        return (parseInt(whole) + parseFloat(decimal)).toString();
    });
    
    // Then replace standalone fractions
    for (const [vulgar, decimal] of Object.entries(fractionMap)) {
        normalized = normalized.replace(new RegExp(vulgar, 'g'), decimal);
    }
    
    return normalized;
}

// ---------- Structured extraction helpers (copied from urlExtractor.js) ----------
function extractTitle($) {
  const selectors = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'h1',
    '.recipe-title',
    '#recipe-title'
  ];
  for (const sel of selectors) {
    if (sel.startsWith('meta')) {
      const content = $(sel).attr('content');
      if (content) return content.trim();
    } else {
      const text = $(sel).first().text().trim();
      if (text) return text;
    }
  }
  return null;
}

function extractDescription($) {
  const selectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    '.recipe-description',
    '#recipe-description',
    '.description'
  ];
  for (const sel of selectors) {
    if (sel.startsWith('meta')) {
      const content = $(sel).attr('content');
      if (content) return content.trim();
    } else {
      const text = $(sel).first().text().trim();
      if (text && text.length > 20) return text;
    }
  }
  return null;
}

function extractIngredientsStructured($) {
  const ingredients = [];
  
  // Expanded container selectors
  const containerSelectors = [
    '.ingredients',
    '#ingredients',
    '.recipe-ingredients',
    '.ingredients-list',
    '[itemprop="recipeIngredient"]',
    '.ingredients-group',
    // AllRecipes specific
    '.mntl-structured-ingredients',
    '.mntl-recipe-ingredients',
    // General fallbacks
    'div[class*="ingredient"]',
    'section[class*="ingredient"]'
  ];

  let $container = null;
  for (const sel of containerSelectors) {
    $container = $(sel).first();
    if ($container.length) {
      console.log(`   Found ingredients container: ${sel}`);
      break;
    }
  }

  if ($container && $container.length) {
    // AllRecipes uses a specific structure
    $container.find('[data-ingredient-quantity], [data-ingredient-name], li, .ingredient-item').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 3 && !text.match(/^(scale|original recipe|yields?|servings?)/i)) {
        ingredients.push(text);
      }
    });
  } else {
    // More aggressive fallback: look for any list that contains fraction characters
    $('ul, ol').each((i, ul) => {
      const text = $(ul).text();
      if (text.match(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/) || text.match(/\d+\s*\/\s*\d+/)) {
        console.log(`   Found ingredient list with fractions`);
        $(ul).find('li').each((j, li) => {
          const line = $(li).text().trim();
          if (line && line.length > 3) ingredients.push(line);
        });
        return false;
      }
    });
  }
  
  console.log(`   Found ${ingredients.length} ingredient lines`);
  return [...new Set(ingredients)];
}

function extractStepsStructured($) {
  const steps = [];
  const containerSelectors = [
    '.instructions',
    '#instructions',
    '.recipe-instructions',
    '.steps',
    '.directions',
    '[itemprop="recipeInstructions"]',
    '.recipe-directions'
  ];

  let $container = null;
  for (const sel of containerSelectors) {
    $container = $(sel).first();
    if ($container.length) break;
  }

  if ($container && $container.length) {
    $container.find('li, p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) steps.push(text);
    });
  } else {
    $('ol').each((i, ol) => {
      $(ol).find('li').each((j, li) => {
        const text = $(li).text().trim();
        if (text) steps.push(text);
      });
    });
  }
  return steps;
}

function extractMetadata($) {
  const meta = { prep: null, cook: null, servings: null };
  const bodyText = $('body').text();
  
  // Servings patterns
  const servingsPatterns = [
    /servings?\s*:?\s*(\d+)/i,
    /yields?\s*:?\s*(\d+)/i,
    /portions?\s*:?\s*(\d+)/i,
    /(\d+)\s*servings?/i
  ];
  
  for (const pattern of servingsPatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      meta.servings = match[1];
      break;
    }
  }

  // Time patterns
  const prepMatch = bodyText.match(/(?:prep\s*time\s*:?\s*)(\d+)\s*(?:min|minutes?)/i);
  if (prepMatch) meta.prep = prepMatch[1] + ' min';

  const cookMatch = bodyText.match(/(?:cook\s*time\s*:?\s*)(\d+)\s*(?:min|minutes?)/i);
  if (cookMatch) meta.cook = cookMatch[1] + ' min';

  const totalMatch = bodyText.match(/(?:total\s*time\s*:?\s*)(\d+)\s*(?:hr|hour|min)/i);
  if (totalMatch) {
    // Convert to minutes if needed
    const timeStr = totalMatch[1];
    if (totalMatch[0].includes('hr')) {
      meta.total = parseInt(timeStr) * 60 + ' min';
    }
  }

  return meta;
}

// ---------- Fetch HTML ----------
async function fetchHtml(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
    });
    return response.data;
}

// ---------- Extract metadata from page ----------
async function extractPageMetadata($, url) {
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('meta[name="twitter:title"]').attr('content') ||
                  $('title').text() ||
                  $('h1').first().text() ||
                  'Untitled Recipe';
    const description = $('meta[name="description"]').attr('content') ||
                        $('meta[property="og:description"]').attr('content') ||
                        '';
    const image = $('meta[property="og:image"]').attr('content') ||
                  $('meta[name="twitter:image"]').attr('content') ||
                  $('article img').first().attr('src') ||
                  null;
    // Resolve relative image URL
    let imageUrl = image;
    if (image && !image.startsWith('http')) {
        try {
            imageUrl = new URL(image, url).href;
        } catch (e) {}
    }
    return { title: title.trim(), description: description.trim(), imageUrl };
}

// ---------- Clean page text (remove noise, normalize fractions) ----------
function cleanPageText($) {
    // Remove noise elements
    $('script, style, nav, header, footer, aside, .ad, .comment, .sidebar, .rating, .social, .print, .share, .related, .comments').remove();

    // Try to find main content container
    const mainSelectors = [
        'article', '.recipe-content', '.entry-content', '.post-content',
        'main', '.content', '#content', 'body'
    ];
    let $main = null;
    for (const sel of mainSelectors) {
        $main = $(sel).first();
        if ($main.length) break;
    }
    if (!$main || !$main.length) $main = $('body');

    // Get raw text
    let rawText = $main.text()
        .replace(/\s+/g, ' ')          // collapse multiple spaces
        .replace(/\n\s*\n/g, '\n\n')    // keep paragraph breaks
        .trim();

    // Normalize vulgar fractions to decimals (e.g., ½ → 0.5)
    rawText = normalizeFractions(rawText);
    
    return rawText;
}

// ---------- Main endpoint function ----------
async function extractRecipeFromUrl(req, res) {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { url, userId = null } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, message: "URL is required" });
        }

        console.log("\n🌐 ========== STARTING URL RECIPE EXTRACTION ==========");
        console.log(`Source: ${url}`);

        // ----- Step 0: Check if URL has been processed before -----
        console.log("🌐 Step 0: Checking for existing recipe...");
        const existingCheck = await pool.query(
            `SELECT r.id as recipe_id, r.title, tc.id as conversion_id
             FROM transcript_conversions tc
             LEFT JOIN recipes r ON tc.recipe_json->>'title' = r.title
             WHERE tc.source_url = $1 AND tc.status = 'recipe_generated'
             ORDER BY tc.created_at DESC LIMIT 1`,
            [url]
        );
        if (existingCheck.rows.length > 0 && existingCheck.rows[0].recipe_id) {
            console.log(`✅ Found existing recipe! ID: ${existingCheck.rows[0].recipe_id}`);
            return res.json({
                success: true,
                redirect: true,
                recipeId: existingCheck.rows[0].recipe_id,
                message: "Recipe already exists for this URL",
                processingTime: Date.now() - startTime
            });
        }

        // ----- Step 1: Validate URL and fetch HTML -----
        console.log("🌐 Step 1: Validating URL and fetching page...");
        let html;
        try {
            html = await fetchHtml(url);
        } catch (fetchError) {
            console.error("❌ Failed to fetch URL:", fetchError.message);
            return res.status(400).json({
                success: false,
                message: "Could not fetch the URL",
                error: fetchError.message
            });
        }
        const $ = cheerio.load(html);
        console.log("✅ Page fetched successfully");

        // ----- Step 2: Extract metadata (title, description, image) -----
        console.log("🌐 Step 2: Extracting metadata...");
        const metadata = await extractPageMetadata($, url);
        console.log(`   Title: "${metadata.title}"`);
        console.log(`   Description length: ${metadata.description.length}`);
        console.log(`   Image: ${metadata.imageUrl || 'none'}`);

        // ----- Step 3: Clean page text (remove noise, normalize fractions) -----
// ----- Step 3: Extract structured content and build clean text -----
console.log("🌐 Step 3: Extracting structured content...");
const title = extractTitle($);
const description = extractDescription($);
const ingredients = extractIngredientsStructured($);
const steps = extractStepsStructured($);

// Build a clean text representation for the LLM
let cleanText = '';
if (title) cleanText += `Title: ${title}\n\n`;
if (description) cleanText += `Description: ${description}\n\n`;
if (ingredients.length) {
  cleanText += 'INGREDIENTS:\n' + ingredients.join('\n') + '\n\n';
}
if (steps.length) {
  cleanText += 'INSTRUCTIONS:\n' + steps.join('\n') + '\n\n';
}
if (metadata.prep) cleanText += `Prep time: ${metadata.prep}\n`;
if (metadata.cook) cleanText += `Cook time: ${metadata.cook}\n`;
if (metadata.servings) cleanText += `Servings: ${metadata.servings}\n`;

// If we got nothing, fall back to whole body text
if (!cleanText) {
  console.log('⚠️ No structured content found, using full body text');
  cleanText = $('body').text().replace(/\s+/g, ' ').trim();
}

// Normalize fractions (already applied in cleanPageText, but ensure it's done)
cleanText = normalizeFractions(cleanText);

const maxLength = 8000;
const textForLLM = cleanText.length > maxLength ? cleanText.slice(0, maxLength) + '…' : cleanText;
console.log(`   Extracted text length: ${textForLLM.length} chars`);
console.log('   Sample:', textForLLM.substring(0, 300));
        // ----- Step 4: Generate recipe with LLM (using advanced prompt from simpleRecipeExtractor) -----
        console.log("🌐 Step 4: Generating recipe with Groq LLM...");
        let finalRecipe;
        try {
            finalRecipe = await generateRecipeFromWebsiteText(textForLLM, metadata.title, url);
            console.log(`✅ Recipe generated: "${finalRecipe.title}"`);
            console.log(`   Ingredients: ${finalRecipe.ingredients.length}`);
            console.log(`   Steps: ${finalRecipe.steps.length}`);
        } catch (llmError) {
            console.error("❌ LLM generation failed:", llmError.message);
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'website',
                source_url: url,
                video_title: metadata.title,
                transcript_text: textForLLM,
                status: 'recipe_generation_failed',
                error_message: llmError.message,
                processing_time_ms: Date.now() - startTime
            });
            return res.status(500).json({
                success: false,
                conversionId,
                message: "Failed to generate recipe",
                error: llmError.message
            });
        }

        // ----- Step 5: Match ingredients with database -----
        console.log("🌐 Step 5: Matching ingredients with database...");
        let ingredientMatches;
        try {
            ingredientMatches = await matchIngredientsWithDatabase(finalRecipe.ingredients);
        } catch (matchError) {
            console.warn("⚠️ Ingredient matching error (continuing):", matchError.message);
            ingredientMatches = {
                all: finalRecipe.ingredients.map(ing => ({ ...ing, dbId: null, found: false })),
                matched: [],
                unmatched: finalRecipe.ingredients,
                matchPercentage: 0
            };
        }

        // ----- Step 6: Complete missing metadata (times, servings, etc.) -----
        console.log("🌐 Step 6: Completing missing metadata...");
        finalRecipe = await completeMissingMetadata(finalRecipe, textForLLM, metadata.title);
        console.log("✅ Metadata completion done");

        // ----- Step 7: Log conversion -----
        console.log("🌐 Step 7: Logging conversion to database...");
        conversionId = await logConversion({
            user_id: userId,
            source_type: 'website',
            source_url: url,
            video_title: metadata.title,
            transcript_text: textForLLM,
            recipe_json: finalRecipe,
            recipe_status: 'generated',
            status: 'recipe_generated',
            processing_time_ms: Date.now() - startTime
        });
        console.log(`✅ Conversion logged with ID: ${conversionId}`);
        console.log("🌐 ========== URL EXTRACTION COMPLETE ==========\n");

        res.json({
            success: true,
            conversionId,
            recipe: finalRecipe,
            ingredientMatches,
            videoTitle: metadata.title,
            videoThumbnail: metadata.imageUrl,
            processingTime: Date.now() - startTime,
            message: "✅ Recipe extracted from URL successfully!"
        });

    } catch (error) {
        console.error("\n❌ CRITICAL ERROR:", error.message);
        if (conversionId) {
            await logConversionError(conversionId, 'CriticalError', error.message, 'extraction');
        }
        res.status(500).json({
            success: false,
            conversionId,
            message: "Server error during URL extraction",
            error: error.message
        });
    }
}

module.exports = {
    extractRecipeFromUrl
};