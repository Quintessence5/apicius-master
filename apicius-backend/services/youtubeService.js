const axios = require('axios');
const pool = require('../config/db');

const {
    analyzeDescriptionContent,
    generateRecipeWithLLM,
    generateRecipeFromTranscript
} = require('../services/videoToRecipeService');
const {extractIngredientsFromText} = require('../services/utils/ingredientExtractor');
const{
    normalizeIngredients,
    matchIngredientsWithDatabase, mergeIngredients} = require('../controllers/videoRecipeController');
const { extractVideoId, detectPlatform } = require('../services/utils/videoUtils');
const { logConversion, logConversionError } = require('../services/conversionLogger');
const { getYouTubeTranscript } = require('./youtubeAudioService');
const { extractRecipeFromCreatorWebsite } = require('./utils/tikTokExtractor');
const { completeMissingMetadata } = require('./videoToRecipeService');
const { getVideoDuration } = require('./utils/duration');

// __________-------------Get YouTube Video Thumbnail-------------__________
const getYouTubeThumbnail = (videoId) => {
    try {
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
        return thumbnailUrl;
    } catch (error) {
        console.error("Error getting YouTube thumbnail:", error);
        return null;
    }
};

// __________-------------Get YouTube Video Description-------------__________
const getYouTubeDescription = async (videoUrl) => {
    try {
        console.log("📄 Fetching YouTube video description...");
        
        const videoIdMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
        if (!videoIdMatch) {
            throw new Error("Invalid YouTube URL format");
        }
        
        const videoId = videoIdMatch[1];
        const apiKey = process.env.YOUTUBE_API_KEY;
        
        if (!apiKey) {
            throw new Error("YOUTUBE_API_KEY not set in environment variables");
        }
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                id: videoId,
                part: 'snippet',
                key: apiKey
            },
            timeout: 10000
        });
        
        if (!response.data.items || response.data.items.length === 0) {
            throw new Error("Video not found or is private");
        }
        
        const videoData = response.data.items[0].snippet;
        
        return {
            title: videoData.title || null,
            description: videoData.description || null,
            channelTitle: videoData.channelTitle || null,
            videoId: videoId
        };
        
    } catch (error) {
        console.error("❌ Error fetching YouTube description:", error.message);
        throw error;
    }
};

// __________-------------Main Endpoint: Extract Recipe from Video-------------__________
const extractRecipeFromYoutube = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { videoUrl, userId = null } = req.body;
        if (!videoUrl) {
            return res.status(400).json({ success: false, message: "Video URL is required" });
        }

        console.log("\n🎬 ========== STARTING RECIPE EXTRACTION ==========");
        console.log(`Source: ${videoUrl}`);
        console.log("📼 Step 0: Checking for existing recipe...");
        
        //______Step 0: Check if this URL has been processed before
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

        //______Step 1: Validate URL and extract video ID
        console.log("📼 Step 1: Validating URL...");
        
        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({ success: false, message: "Invalid YouTube URL format" });
        }
        console.log(`✅ Valid URL. Video ID: ${videoId}`);

        //______Step 2: Fetch metadata
        console.log("\n📼 Step 2: Fetching YouTube metadata...");
        let youtubeMetadata;
        let videoThumbnail = null; 
        try {
            youtubeMetadata = await getYouTubeDescription(videoUrl);
            videoThumbnail = getYouTubeThumbnail(videoId);
            console.log(`✅ Title: "${youtubeMetadata.title}"`);
            console.log(`✅ Description length: ${youtubeMetadata.description?.length || 0} characters`);
            console.log(`✅ Thumbnail: ${videoThumbnail}`);
        } catch (error) {
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'youtube',
                source_url: videoUrl,
                status: 'metadata_fetch_failed',
                error_message: error.message,
                processing_time_ms: Date.now() - startTime
            });

            return res.status(400).json({
                success: false,
                conversionId,
                message: "Could not fetch YouTube video",
                error: error.message
            });
        }

        //______Step 3: Analyze description
        console.log("\n📼 Step 3: Analyzing description content...");
        const analysis = analyzeDescriptionContent(youtubeMetadata.description);
        console.log(`   - Has ingredients: ${analysis.hasIngredients}`);
        console.log(`   - Has steps: ${analysis.hasSteps}`);
        console.log(`   - Total lines: ${analysis.lineCount}`);

        //______Step 4: Extract ingredients from description (base list)
        console.log("\n📼 Step 4: Extracting ingredients from description...");
        let extractedIngredients = extractIngredientsFromText(youtubeMetadata.description);
        console.log(`✅ Extracted ${extractedIngredients.length} ingredients from description`);

        // ______Step 5: If ingredients are sparse OR steps are missing, try to supplement
        let topCommentsText = "";
        let audioTranscriptText = "";

        // 5a: Mine YouTube comments first (cheaper, faster)
        console.log("\n📼 Step 5a: Checking if comment mining is needed...");
        if ((extractedIngredients.length < 4 || !analysis.hasSteps) && process.env.YOUTUBE_API_KEY) {
            try {
                const allComments = await fetchYouTubeComments(videoId);
                if (allComments.length > 0) {
                    const minedData = mineRecipeFromComments(allComments);
                    if (minedData.found && minedData.ingredients.length > 0) {
                        console.log(`✅ Mined ${minedData.ingredients.length} ingredients from comments`);
                        if (minedData.topComments && minedData.topComments.length > 0) {
                            topCommentsText = minedData.topComments.slice(0, 5).join('\n\n---\n\n');
                        }
                        extractedIngredients = mergeIngredients(extractedIngredients, minedData.ingredients);
                        console.log(`✅ Ingredients after merging comments: ${extractedIngredients.length}`);
                    } else {
                        console.warn(`⚠️ Comment mining: ${minedData.reason}`);
                    }
                }
            } catch (miningError) {
                console.warn("⚠️ Comment mining failed (continuing):", miningError.message);
            }
        } else {
            console.log("✅ Sufficient ingredients/steps, skipping comment mining");
        }

        // ----- 5b: Try creator's website -----
        console.log("\n📼 Step 5b: Attempting to extract recipe from creator's website...");
        let websiteRecipeContent = "";
        if (extractedIngredients.length < 4 || !analysis.hasSteps) {
            try {
                // Use the same function as TikTok, passing description and channel title as creator name
                const websiteResult = await extractRecipeFromCreatorWebsite(
                    youtubeMetadata.description,
                    youtubeMetadata.channelTitle // channel name as creator
                );
                if (websiteResult && websiteResult.recipe) {
                    console.log(`✅ Found recipe on creator website: "${websiteResult.recipe.title}"`);
                    // Store the full recipe content for LLM reference
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
                        console.log(`✅ Ingredients after merging website: ${extractedIngredients.length}`);
                    }
                } else {
                    console.log("⚠️ No recipe found on creator website");
                }
            } catch (websiteError) {
                console.warn(`⚠️ Website extraction failed (continuing): ${websiteError.message}`);
            }
        } else {
            console.log("✅ Sufficient ingredients/steps, skipping website search");
        }

        // Step 6: Try audio transcription
        console.log("\n📼 Step 6: Checking if audio transcription is needed...");
if (extractedIngredients.length < 4 || !analysis.hasSteps) {
    try {
        // Check duration
        const duration = await getVideoDuration(videoUrl);
        if (duration && duration > 180) {
            console.log(`⏱️ Video duration ${duration}s > 180s, skipping audio transcription.`);
        } else {
            console.log("   Downloading and transcribing audio...");
            const audioResult = await getYouTubeTranscript(videoUrl);
            if (audioResult.success && audioResult.transcript) {
                audioTranscriptText = audioResult.transcript;
                console.log(`✅ Audio transcript obtained. Length: ${audioTranscriptText.length} chars`);
                // ... rest
            } else {
                console.warn("⚠️ Audio transcription returned no text");
            }
        }
    } catch (audioError) {
        console.warn(`⚠️ Audio transcription failed (continuing): ${audioError.message}`);
    }
} else {
    console.log("✅ Sufficient ingredients/steps already, skipping audio transcription");
}

        // ______Step 7: Generate recipe with LLM
        console.log("\n📼 Step 7: Generating complete recipe with Groq LLM...");
        let finalRecipe;
        try {
            // If we have a substantial audio/caption transcript, use the transcript‑optimized version
            if (audioTranscriptText && audioTranscriptText.trim().length > 50) {
                console.log("🎤 Using transcript-based recipe generation (with quantity inference)...");
                finalRecipe = await generateRecipeFromTranscript(
                audioTranscriptText,
                youtubeMetadata.title,
                youtubeMetadata.channelTitle,
                extractedIngredients,
                youtubeMetadata.description,
                topCommentsText
            );
            } else {
                console.log("📄 Using description-based recipe generation...");
                // Combine website content with other supplements
                let supplemental = "";
                if (websiteRecipeContent) supplemental += `WEBSITE RECIPE CONTENT:\n${websiteRecipeContent}\n\n`;
                if (topCommentsText) supplemental += `⭐ TOP COMMENTS:\n${topCommentsText}\n\n`;
                finalRecipe = await generateRecipeWithLLM(
                youtubeMetadata.description,
                youtubeMetadata.title,
                youtubeMetadata.channelTitle,
                extractedIngredients,
                topCommentsText,
                supplemental,
                audioTranscriptText
                );
            }
    
            console.log(`\n✅ RECIPE GENERATED!`);
            console.log(`   Title: "${finalRecipe.title}"`);
            console.log(`   Ingredients: ${finalRecipe.ingredients.length}`);
            console.log(`   Steps: ${finalRecipe.steps.length}`);
    
            
        } catch (groqError) {
            console.error("\n❌ LLM Error:", groqError.message);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'youtube',
                source_url: videoUrl,
                video_title: youtubeMetadata.title,
                transcript_text: youtubeMetadata.description,
                status: 'recipe_generation_failed',
                error_message: groqError.message,
                processing_time_ms: Date.now() - startTime
            });

            if (conversionId) {
                await logConversionError(conversionId, 'GroqError', groqError.message, 'recipe_generation');
            }

            return res.status(500).json({
                success: false,
                conversionId,
                message: "Failed to generate recipe",
                error: groqError.message
            });
        }

        //_______Step 8 Match ingredients with database
        console.log("\n📼 Step 8: Matching ingredients with database...");
        let ingredientMatches;
        try {
            ingredientMatches = await matchIngredientsWithDatabase(finalRecipe.ingredients);
        } catch (matchError) {
            console.warn("⚠️ Ingredient matching error (continuing anyway):", matchError.message);
            ingredientMatches = {
                all: finalRecipe.ingredients.map(ing => ({
                    ...ing,
                    dbId: null,
                    found: false,
                    icon: '⚠️'
                })),
                matched: [],
                unmatched: finalRecipe.ingredients,
                matchPercentage: 0
            };
        }

        // ----- Step 8a: Complete missing metadata -----
console.log("\n📼 Step 8a: Completing missing metadata...");
const combinedText = [
    youtubeMetadata.description,
    audioTranscriptText,
    topCommentsText,
    websiteRecipeContent
].filter(Boolean).join('\n\n');
finalRecipe = await completeMissingMetadata(
    finalRecipe,
    combinedText,
    youtubeMetadata.title,
    youtubeMetadata.servings // explicit servings if available (from getYouTubeDescription)
);
console.log("✅ Metadata completion done");

        //________Step 9: Log conversion
        console.log("\n📼 Step 9: Logging conversion to database...");
        conversionId = await logConversion({
            user_id: userId,
            source_type: 'youtube',
            source_url: videoUrl,
            video_title: youtubeMetadata.title,
            transcript_text: youtubeMetadata.description,
            recipe_json: finalRecipe,
            recipe_status: 'generated',
            status: 'recipe_generated',
            processing_time_ms: Date.now() - startTime
        });
        console.log(`✅ Conversion logged with ID: ${conversionId}`);

        console.log("\n🎬 ========== EXTRACTION COMPLETE ==========\n");

        res.json({
            success: true,
            conversionId,
            recipe: finalRecipe,
            ingredientMatches: ingredientMatches,
            videoTitle: youtubeMetadata.title,
            channelTitle: youtubeMetadata.channelTitle,
            videoThumbnail: videoThumbnail,
            processingTime: Date.now() - startTime,
            message: "✅ Recipe extracted successfully!"
        });

    } catch (error) {
        console.error("\n❌ CRITICAL ERROR:", error.message);
        
        if (conversionId) {
            await logConversionError(conversionId, 'CriticalError', error.message, 'extraction');
        }

        res.status(500).json({
            success: false,
            conversionId,
            message: "Server error during recipe extraction",
            error: error.message
        });
    }
};

// __________-------------Fetch YouTube Comments-------------__________
const fetchYouTubeComments = async (videoId, maxResults = 100) => {
    try {
        console.log(`\n⛏️ ========== MINING YOUTUBE COMMENTS FOR RECIPE DATA ==========\n`);
        console.log(`⛏️ Step 5.1: Fetching up to ${maxResults} comments...`);

       if (!process.env.YOUTUBE_API_KEY) {
            throw new Error("YOUTUBE_API_KEY not configured");
        }

        const response = await axios.get(
            'https://www.googleapis.com/youtube/v3/commentThreads',
            {
                params: {
                    part: 'snippet',
                    videoId: videoId,
                    textFormat: 'plainText',
                    maxResults: 100,
                    order: 'relevance',
                    key: process.env.YOUTUBE_API_KEY
                },
                timeout: 15000
            }
        );

        if (!response.data.items || response.data.items.length === 0) {
            console.warn("⚠️ No comments found for this video");
            return [];
        }

        const comments = response.data.items
            .map(item => item.snippet.topLevelComment.snippet.textDisplay)
            .filter(text => text && text.length > 20);

        console.log(`✅ Fetched ${comments.length} comments`);
        return comments;

    } catch (error) {
        console.error("❌ Error fetching YouTube comments:", error.message);
        return [];
    }
};

// __________-------------Mine Comments for Recipe Data-------------__________
const mineRecipeFromComments = (commentTexts) => {
    console.log(`\n🔍 Step 5.2: Analyzing top comments for recipe content...\n`);
    
    if (!commentTexts || commentTexts.length === 0) {
        console.warn("⚠️ No comments to analyze");
        return {
            found: false,
            reason: "No comments available",
            ingredients: [],
            topComments: [],
            qualityScore: 0
        };
    }

    // STEP 1: Score comments based on recipe relevance
    console.log(`📊 Scoring ${Math.min(commentTexts.length, 20)} comments for recipe relevance...`);
    
    const scoredComments = commentTexts.slice(0, 20).map((comment, index) => {
        let score = 0;
        
        // Has actual measurements
        if (comment.match(/(\d+\.?\d*)\s*(g|ml|cup|tbsp|tsp|oz|lb|litre)/gi)) {
            score += 35;
            console.log(`   Comment ${index + 1}: Has measurements (+35)`);
        }
        
        // Has ingredient keywords
        if (comment.match(/flour|sugar|butter|eggs|milk|oil|baking|powder|soda|cream|chocolate|cocoa|salt|vanilla/i)) {
            score += 25;
        }
        
        // Has structure (multiple lines)
        const lineCount = (comment.match(/\n/g) || []).length;
        if (lineCount > 3) {
            score += 15;
            console.log(`   Comment ${index + 1}: Has structure, ${lineCount} lines (+15)`);
        }
        
        // Has cooking instructions
        if (comment.match(/bake|mix|heat|cook|oven|temperature|preheat|fold|whisk/i)) {
            score += 10;
        }
        
        // Has imperial/metric versions
        if (comment.match(/metric|imperial|version|\/\//)) {
            score += 5;
        }
        
        // Penalize very short comments
        if (comment.length < 50) score -= 20;
        
        return {
            text: comment,
            score: Math.max(0, score),
            index: index
        };
    });

    // STEP 2: Get top 5-10 comments
    const topScored = scoredComments
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    console.log(`\n✅ Top ${topScored.length} comments selected:`);
    topScored.forEach(c => {
        console.log(`   - Comment ${c.index + 1}: Score ${c.score}`);
    });

    // STEP 3: Extract ingredients from top comments
    console.log(`\n🥘 Extracting ingredients from top comments...`);
    
    let allIngredients = [];
    let commentSources = [];

    for (const scored of topScored) {
        if (scored.score < 5) continue;

        const extracted = extractIngredientsFromText(scored.text);
        
        if (extracted.length > 0) {
            console.log(`   - Comment ${scored.index + 1}: Found ${extracted.length} ingredients`);
            allIngredients = allIngredients.concat(extracted);
            commentSources.push(scored.text);
        }
    }

    if (allIngredients.length === 0) {
        console.warn("⚠️ No ingredients extracted from comments");
        return {
            found: false,
            reason: "No ingredients found in comments",
            ingredients: [],
            topComments: [],
            qualityScore: 0
        };
    }

    // STEP 4: Normalize and deduplicate
    console.log(`\n🔄 Normalizing ${allIngredients.length} ingredient entries...`);
    
    const normalized = normalizeIngredients(allIngredients);
    
    console.log(`✅ Final count: ${normalized.length} unique ingredients`);

    // STEP 5: Calculate quality score
    const qualityScore = Math.min(100, Math.round(
        (normalized.length / 25) * 40 +          // Ingredient count (0-40)
        (topScored.length / 10) * 30 +           // Comment count (0-30)
        (topScored.reduce((a, b) => a + b.score, 0) / topScored.length / 2) // Avg score (0-30)
    ));

    console.log(`📊 Mining quality score: ${qualityScore}/100\n`);

    return {
        found: true,
        ingredientCount: normalized.length,
        sourceCommentCount: commentSources.length,
        commentQuality: qualityScore,
        ingredients: normalized,
        topComments: commentSources, // Array of full comment texts
        qualityScore: qualityScore
    };
};


module.exports = {
    getYouTubeDescription,
    getYouTubeThumbnail,
    extractRecipeFromYoutube,
    fetchYouTubeComments,
    mineRecipeFromComments
};