const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('../config/db');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { extractIngredientsFromText } = require('../services/utils/ingredientExtractor');
const { generateRecipeWithLLM } = require('../services/videoToRecipeService');
const { mergeIngredients, matchIngredientsWithDatabase } = require('../controllers/videoRecipeController');
const { logConversion, logConversionError } = require('../services/conversionLogger');
const { generateRecipeFromTranscript } = require('./videoToRecipeService');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { completeMissingMetadata } = require('./videoToRecipeService');

const {
    extractTikTokVideoId,
    isValidTikTokUrl,
    extractDescriptionFromContext,
    parseDuration,
    getTikTokSubtitles,
    downloadTikTokAudioWithYtDlp,
    transcribeAudioWithAssemblyAI,
    getTikTokAudioTranscript,
    getTikTokThumbnail,
    analyzeTikTokDescription,
    validateTikTokUrl,
    extractRecipeFromCreatorWebsite
} = require('./utils/tikTokExtractor');
const { getVideoDuration } = require('./utils/duration');

// __________-------------GET TIKTOK METADATA WITH IMPROVED EXTRACTION-------------__________
const getTikTokMetadata = async (videoUrl) => {
    let browser;
    try {
        console.log("📄 Fetching TikTok video metadata...");
        
        const videoId = extractTikTokVideoId(videoUrl);
        if (!videoId) {
            throw new Error("Invalid TikTok URL format");
        }

        const cleanUrl = videoUrl.split('?')[0];
        console.log(`🔗 Cleaned URL: ${cleanUrl}`);

        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 720 });

        console.log("🌐 Loading TikTok video page...");
        await page.goto(cleanUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get title
        const title = await page.evaluate(() => {
            const selectors = [
                'h1',
                '[data-e2e="video-title"]',
                'meta[property="og:title"]'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const content = element.getAttribute ? 
                        element.getAttribute('content') : 
                        element.textContent;
                    if (content && content.trim()) {
                        return content.trim();
                    }
                }
            }
            return null;
        });

        // Get creator
        const creatorMatch = cleanUrl.match(/@([\w.-]+)/);
        const creator = creatorMatch ? creatorMatch[1] : 'TikTok Creator';

        // Get page HTML
        const pageHTML = await page.content();

        // Extract description
        let description = extractDescriptionFromContext(pageHTML);

        // If still no description, try Puppeteer's direct text extraction
        if (!description || description.length < 50) {
            console.log("⚠️ Primary extraction gave limited results, trying comprehensive text extraction...");
            
            description = await page.evaluate(() => {
                return document.body.innerText || '';
            });
        }

        // Get thumbnail
        const thumbnail = await page.evaluate(() => {
            return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
        });

        await browser.close();

        console.log("✅ TikTok video page loaded");
        console.log(`✅ Title: "${title || 'TikTok Video'}"`);
        console.log(`✅ Creator: @${creator}`);
        console.log(`✅ Description length: ${description?.length || 0} characters`);
        console.log(`✅ Thumbnail: ${thumbnail ? '✓' : '✗'}`);

        return {
            title: title || 'TikTok Video Recipe',
            description: description || 'Cooking video from TikTok',
            creator: creator,
            creatorAvatar: null,
            thumbnail: thumbnail,
            videoId: videoId,
            originalUrl: videoUrl
        };

    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }
        console.error("❌ Error fetching TikTok metadata:", error.message);
        throw new Error(`Could not fetch TikTok video metadata: ${error.message}`);
    }
};

// ---------- Download and save thumbnail ----------
const downloadThumbnail = async (videoUrl, outputDir) => {
    const { execa } = await import('execa');
    const outputTemplate = path.join(outputDir, '%(id)s_thumbnail.%(ext)s');
    try {
        console.log(`   🖼️ Downloading thumbnail with yt-dlp...`);
        await execa('yt-dlp', [
            videoUrl,
            '--skip-download',
            '--write-thumbnail',
            '--convert-thumbnails', 'jpg',
            '--output', outputTemplate,
            '--quiet'
        ]);
        const files = await fs.readdir(outputDir);
        const thumbFile = files.find(f => f.includes('_thumbnail.') && f.endsWith('.jpg'));
        if (thumbFile) {
            const fullPath = path.join(outputDir, thumbFile);
            console.log(`   ✅ Thumbnail downloaded: ${fullPath}`);
            return fullPath;
        }
        console.log(`   ⚠️ No thumbnail file found in output directory.`);
        return null;
    } catch (error) {
        console.error(`   ❌ yt-dlp thumbnail error: ${error.message}`);
        return null;
    }
};

// ---------- Main endpoint (updated with correct variable scoping) ----------
const extractRecipeFromTikTok = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { videoUrl, userId = null } = req.body;
        if (!videoUrl) {
            return res.status(400).json({ success: false, message: "Video URL is required" });
        }

        console.log("\n🎬 ========== STARTING TIKTOK RECIPE EXTRACTION ==========");
        console.log(`Source: ${videoUrl}`);
        console.log("📼 Step 0: Checking for existing recipe...");

        // Check for existing recipe (same as before)
        const existingRecipeCheck = await pool.query(
            `SELECT r.id as recipe_id, r.title, tc.id as conversion_id
             FROM transcript_conversions tc
             LEFT JOIN recipes r ON tc.recipe_json->>'title' = r.title
             WHERE tc.source_url = $1 AND tc.status = 'recipe_generated'
             ORDER BY tc.created_at DESC LIMIT 1`,
            [videoUrl]
        );

        if (existingRecipeCheck.rows.length > 0 && existingRecipeCheck.rows[0].recipe_id) {
            console.log(`✅ Found existing recipe! ID: ${existingRecipeCheck.rows[0].recipe_id}`);
            return res.json({
                success: true,
                redirect: true,
                recipeId: existingRecipeCheck.rows[0].recipe_id,
                message: "Recipe already exists for this URL",
                processingTime: Date.now() - startTime
            });
        }

        // Step 1: Validate URL
        console.log("📼 Step 1: Validating TikTok URL...");
        const urlValidation = validateTikTokUrl(videoUrl);
        if (!urlValidation.isValid) {
            console.log(`❌ Invalid TikTok URL: ${urlValidation.error}`);
            conversionId = await logConversion({ /* ... */ });
            return res.status(400).json({ /* ... */ });
        }
        const videoId = urlValidation.videoId;
        console.log(`✅ Valid TikTok URL. Video ID: ${videoId}`);

        // Step 2: Fetch metadata
        console.log("\n📼 Step 2: Fetching TikTok metadata...");
        let tikTokMetadata;
        
        try {
            tikTokMetadata = await getTikTokMetadata(videoUrl);
            console.log(`✅ Title: "${tikTokMetadata.title}"`);
            console.log(`✅ Creator: @${tikTokMetadata.creator}`);
            console.log(`✅ Description length: ${tikTokMetadata.description?.length || 0} characters`);
        } catch (metadataError) {
            console.warn(`⚠️ TikTok metadata fetch failed: ${metadataError.message}`);
            await logConversion({ /* ... */ });
            return res.status(400).json({
                success: false,
                requiresManualInput: true,
                message: "Could not automatically fetch TikTok video data",
                error: metadataError.message,
                suggestion: "Please paste the video description or transcript manually below"
            });
        }

        // Step 3: Analyze description
        console.log("\n📼 Step 3: Analyzing description content...");
        const analysis = analyzeTikTokDescription(tikTokMetadata.description);
        console.log(`   - Has ingredients: ${analysis.hasIngredients}`);
        console.log(`   - Has steps: ${analysis.hasSteps}`);
        console.log(`   - Ingredient count (unit matches): ${analysis.ingredientCount}`);
        console.log(`   - Total lines: ${analysis.lineCount}`);

        const sufficientIngredientsFromDescription = analysis.ingredientCount >= 4;

        // Step 4: Extract ingredients
        console.log("\n📼 Step 4: Extracting ingredients from description...");
        let extractedIngredients = [];
        let websiteRecipeContent = "";
        let subtitleText = "";
        let audioTranscriptText = "";

        // Always attempt standard extraction (might get some ingredients even if analysis is optimistic)
        extractedIngredients = extractIngredientsFromText(tikTokMetadata.description);
        console.log(`✅ Extracted ${extractedIngredients.length} ingredients from description`);

        // Enhanced fallback if needed
        if (extractedIngredients.length === 0 && tikTokMetadata.description.length > 100) {
            console.log("⚠️ No ingredients found with standard extractor, trying enhanced extraction...");
            // You can add a simple fallback here if desired
        }

        // Decide whether to skip expensive steps
        let skipRemainingSteps = sufficientIngredientsFromDescription || extractedIngredients.length >= 4;

        if (!skipRemainingSteps) {
            // Step 5: Try creator's website
            console.log("\n📼 Step 5: Attempting to extract recipe from creator's website...");
            if (extractedIngredients.length < 4) {
                try {
                    const websiteResult = await extractRecipeFromCreatorWebsite(
                        tikTokMetadata.description,
                        tikTokMetadata.creator
                    );
                    if (websiteResult && websiteResult.recipe) {
                        console.log(`✅ Found recipe on creator website: "${websiteResult.recipe.title}"`);
                        websiteRecipeContent = websiteResult.recipe.description || JSON.stringify(websiteResult.recipe);
                        if (websiteResult.recipe.ingredients && websiteResult.recipe.ingredients.length > 0) {
                            const websiteIngredients = websiteResult.recipe.ingredients.map(ing => ({
                                name: ing.name,
                                quantity: ing.quantity,
                                unit: ing.unit,
                                section: ing.section || 'Main'
                            }));
                            console.log(`✅ Extracted ${websiteIngredients.length} ingredients from website`);
                            extractedIngredients = mergeIngredients(extractedIngredients, websiteIngredients);
                        }
                    } else {
                        console.log("⚠️ No recipe found on creator website");
                    }
                } catch (websiteError) {
                    console.warn(`⚠️ Website scraping failed (continuing): ${websiteError.message}`);
                }
            } else {
                console.log("✅ Sufficient ingredients found, skipping website search");
            }

            // Step 5a: Try subtitles
            console.log("\n📼 Step 5a: Attempting to download auto-generated subtitles...");
            if (extractedIngredients.length < 4) {
                try {
                    const subResult = await getTikTokSubtitles(videoUrl);
                    if (subResult.success && subResult.transcript) {
                        subtitleText = subResult.transcript;
                        console.log(`✅ Subtitles obtained. Length: ${subtitleText.length} chars`);
                        const subIngredients = extractIngredientsFromText(subtitleText);
                        if (subIngredients.length > 0) {
                            console.log(`✅ Extracted ${subIngredients.length} ingredients from subtitles`);
                            extractedIngredients = mergeIngredients(extractedIngredients, subIngredients);
                        }
                    } else {
                        console.log("⚠️ No subtitles available");
                    }
                } catch (subError) {
                    console.warn(`⚠️ Subtitle download failed (continuing): ${subError.message}`);
                }
            } else {
                console.log("✅ Sufficient ingredients, skipping subtitle download");
            }

            // Step 6: Try audio transcription
console.log("\n📼 Step 6: Checking if audio transcription is needed...");
if (extractedIngredients.length < 4) {
    try {
        const duration = await getVideoDuration(videoUrl);
        if (duration && duration > 180) {
            console.log(`⏱️ Video duration ${duration}s > 180s, skipping audio transcription.`);
        } else {
            console.log("   Downloading and transcribing audio...");
            const audioResult = await getTikTokAudioTranscript(videoUrl);
            if (audioResult.success && audioResult.transcript) {
                audioTranscriptText = audioResult.transcript;
                console.log(`✅ Audio transcript obtained. Length: ${audioTranscriptText.length} chars`);
                const audioIngredients = extractIngredientsFromText(audioTranscriptText);
                if (audioIngredients.length > 0) {
                    console.log(`✅ Extracted ${audioIngredients.length} ingredients from audio transcript`);
                    extractedIngredients = mergeIngredients(extractedIngredients, audioIngredients);
                }
            } else {
                console.warn("⚠️ Audio transcription returned no text");
            }
        }
    } catch (audioError) {
        console.warn(`⚠️ Audio transcription failed (continuing): ${audioError.message}`);
    }
} else {
    console.log("✅ Sufficient ingredients already, skipping audio transcription");
}
        } else {
            console.log("✅ Sufficient ingredients from description, skipping website/subtitle/audio steps.");
        }

        // Step 7: Generate recipe with LLM
        console.log("\n📼 Step 7: Generating recipe with Groq LLM...");
        let finalRecipe;
        try {
            let primaryTranscript = "";
            let transcriptSource = "";
            if (subtitleText && subtitleText.trim().length > 50) {
                primaryTranscript = subtitleText;
                transcriptSource = "subtitles";
            } else if (audioTranscriptText && audioTranscriptText.trim().length > 50) {
                primaryTranscript = audioTranscriptText;
                transcriptSource = "audio";
            }

            if (primaryTranscript) {
                console.log(`🎤 Using ${transcriptSource}-based recipe generation (with quantity inference)...`);
                finalRecipe = await generateRecipeFromTranscript(
                    primaryTranscript,
                    tikTokMetadata.title,
                    tikTokMetadata.creator,
                    extractedIngredients,
                    tikTokMetadata.description,
                    websiteRecipeContent || ""
                );
            } else {
                console.log("📄 Using description-based recipe generation...");
                let supplemental = "";
                if (websiteRecipeContent) supplemental = `WEBSITE RECIPE CONTENT:\n${websiteRecipeContent}\n\n`;
                finalRecipe = await generateRecipeWithLLM(
                    tikTokMetadata.description,
                    tikTokMetadata.title,
                    tikTokMetadata.creator,
                    extractedIngredients,
                    supplemental,
                    audioTranscriptText
                );
            }
            console.log(`✅ Recipe generated successfully`);
            console.log(`   - Ingredients: ${finalRecipe.ingredients.length}`);
            console.log(`   - Steps: ${finalRecipe.steps.length}`);
        } catch (groqError) {
            console.error("\n❌ LLM Error:", groqError.message);
            conversionId = await logConversion({ /* ... */ });
            return res.status(500).json({ /* ... */ });
        }

       // Step 8: Thumbnail download (after recipe generation) -----
let videoThumbnail = null;
try {
    console.log("📸 Step 8: Downloading video thumbnail...");
    const uploadBaseDir = path.join(__dirname, '../uploads/recipe');
    await fs.mkdir(uploadBaseDir, { recursive: true });
    
    const thumbDir = path.join(uploadBaseDir, crypto.randomUUID());
    await fs.mkdir(thumbDir, { recursive: true });
    
    const savedThumbPath = await downloadThumbnail(videoUrl, thumbDir);
    if (savedThumbPath) {
        const relativePath = savedThumbPath.replace(path.join(__dirname, '..'), '');
        videoThumbnail = relativePath;
        finalRecipe.image_path = relativePath;
        console.log(`   ✅ Thumbnail saved to: ${relativePath}`);
    } else {
        console.log("   ⚠️ Thumbnail download failed, using fallback URL.");
        videoThumbnail = getTikTokThumbnail(videoId, tikTokMetadata.thumbnail);
        finalRecipe.image_path = videoThumbnail; // store fallback URL
    }
} catch (thumbError) {
    console.warn("   ⚠️ Thumbnail processing error, using fallback:", thumbError.message);
    videoThumbnail = getTikTokThumbnail(videoId, tikTokMetadata.thumbnail);
    finalRecipe.image_path = videoThumbnail;
}

        // Step 9: Match ingredients with database
        console.log("\n📼 Step 9: Matching ingredients with database...");
        let ingredientMatches;
        try {
            ingredientMatches = await matchIngredientsWithDatabase(finalRecipe.ingredients);
        } catch (matchError) {
            console.warn("⚠️ Ingredient matching error (continuing anyway):", matchError.message);
            ingredientMatches = { all: finalRecipe.ingredients.map(ing => ({ ...ing, dbId: null, found: false, icon: '⚠️' })), matched: [], unmatched: finalRecipe.ingredients, matchPercentage: 0 };
        }

        // ----- Step 9a: Complete missing metadata -----
console.log("\n📼 Step 9a: Completing missing metadata...");
const combinedText = [
    tikTokMetadata.description,
    subtitleText,
    audioTranscriptText,
    websiteRecipeContent
].filter(Boolean).join('\n\n');
finalRecipe = await completeMissingMetadata(
    finalRecipe,
    combinedText,
    tikTokMetadata.title,
    null // no explicit servings from TikTok
);
console.log("✅ Metadata completion done");

        // Step 10: Log conversion
        console.log("\n📼 Step 10: Logging conversion to database...");
        conversionId = await logConversion({
            user_id: userId,
            source_type: 'tiktok',
            source_url: videoUrl,
            video_title: tikTokMetadata.title,
            transcript_text: tikTokMetadata.description,
            recipe_json: finalRecipe,
            recipe_status: 'generated',
            status: 'recipe_generated',
            processing_time_ms: Date.now() - startTime
        });

        console.log(`✅ Conversion logged with ID: ${conversionId}`);
        console.log("\n🎬 ========== TIKTOK EXTRACTION COMPLETE ==========\n");

        res.json({
            success: true,
            conversionId,
            recipe: finalRecipe,
            ingredientMatches,
            videoTitle: tikTokMetadata.title,
            creator: tikTokMetadata.creator,
            videoThumbnail,
            processingTime: Date.now() - startTime,
            message: "✅ Recipe extracted from TikTok successfully!"
        });

    } catch (error) {
        console.error("\n❌ CRITICAL ERROR:", error.message);
        if (conversionId) await logConversionError(conversionId, 'CriticalError', error.message, 'extraction');
        res.status(500).json({ success: false, conversionId, message: "Server error during TikTok recipe extraction", error: error.message });
    }
};

module.exports = {
    extractTikTokVideoId,
    isValidTikTokUrl,
    getTikTokMetadata,
    getTikTokThumbnail,
    analyzeTikTokDescription,
    validateTikTokUrl,
    extractDescriptionFromContext,
    extractRecipeFromTikTok,
    extractRecipeFromCreatorWebsite
};