const axios = require('axios');
const pool = require('../config/db');

const {
    analyzeDescriptionContent,
    generateRecipeWithLLM
} = require('../services/videoToRecipeService');
const{
    normalizeIngredients,
    normalizeIngredientNameForMatching,
    matchIngredientsWithDatabase,
    mergeIngredients } = require('../controllers/videoRecipeController');
const { extractVideoId, detectPlatform } = require('../services/utils/videoUtils');
const { extractIngredientsFromText } = require('../services/utils/ingredientExtractor');
const { logConversion, logConversionError } = require('../services/conversionLogger');


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

        //______Step 4: Extract ingredients
        console.log("\n📼 Step 4: Extracting ingredients from description...");
        let extractedIngredients = extractIngredientsFromText(youtubeMetadata.description);
        console.log(`✅ Extracted ${extractedIngredients.length} ingredients from descrption`);

        // ______Step 5: If ingredients are sparse, mine YouTube comments
        console.log("\n📼 Step 5: Parsing Comments...");
        let topCommentsText = ""; // Store top comment texts for LLM
        
        if (extractedIngredients.length < 3 && process.env.YOUTUBE_API_KEY) {
            try {
                // Fetch comments first
                const allComments = await fetchYouTubeComments(videoId);

                if (allComments.length > 0) {
                    // Mine for recipe
                    const minedData = mineRecipeFromComments(allComments);
                    
                    if (minedData.found && minedData.ingredients.length > 0) {
                        console.log(`✅ Mined ${minedData.ingredients.length} ingredients from ${minedData.sourceCommentCount} comments`);
                        console.log(`   Quality Score: ${minedData.qualityScore}/100`);
                        console.log(`✅ Mined ${minedData.ingredients.length} ingredients from consensus recipe (Quality: ${minedData.qualityScore}/100)`);
                        
                        // Store top comments for LLM reference
                        if (minedData.topComments && minedData.topComments.length > 0) {
                            topCommentsText = minedData.topComments[0];
                        }
                        
                        // Merge mined ingredients with description ingredients
                        extractedIngredients = mergeIngredients(extractedIngredients, minedData.ingredients);
                        console.log(`✅ Total ingredients after merging: ${extractedIngredients.length}`);
                    } else {
                        console.warn(`⚠️ ${minedData.reason}`);
                    }
                }
            } catch (miningError) {
                console.warn("⚠️ Comment mining failed (continuing with description only):", miningError.message);
            }
        } else if (extractedIngredients.length >= 3) {
            console.log("✅ Sufficient ingredients in description, skipping comment mining");
        } else {
            console.warn("⚠️ YOUTUBE_API_KEY not configured");
        }

        // ______Step 6: Generate recipe with LLM
        console.log("\n📼 Step 6: Generating complete recipe with Groq LLM...");
        let finalRecipe;
        try {
            finalRecipe = await generateRecipeWithLLM(
                youtubeMetadata.description,
                youtubeMetadata.title,
                youtubeMetadata.channelTitle,
                extractedIngredients,
                topCommentsText // Pass the top comments text
            );
            
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

        //_______Step 7 Match ingredients with database
        console.log("\n📼 Step 7: Matching ingredients with database...");
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

        //________Step 8: Log conversion
        console.log("\n📼 Step 8: Logging conversion to database...");
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

    // STEP 5.1: Score comments based on recipe relevance
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
        if (comment.match(/mix|heat|cook|oven|temperature|preheat|fold|whisk/i)) {
            score += 15;
        }

        if (comment.match(/bake|rest|cook|degrees|temperature|farenheit|cut|slice/i)) {
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

    // STEP 5.2: Get top 5-10 comments
    const topScored = scoredComments
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    console.log(`\n✅ Top ${topScored.length} comments selected:`);
    topScored.forEach(c => {
        console.log(`   - Comment ${c.index + 1}: Score ${c.score}`);
    });

    // STEP 5.3: Extract ingredients from top comments
    console.log(`\n🥘 Extracting ingredients from top comments...`);
    
    let allIngredients = [];
    let commentSources = [];
    
    const commentRecipes = [];
    for (const scored of topScored) {
        if (scored.score < 5) continue;

        const extracted = extractIngredientsFromText(scored.text);
        
        if (extracted.length > 0) {
            console.log(`   - Comment ${scored.index + 1}: Found ${extracted.length} ingredients`);
            commentRecipes.push({
                commentIndex: scored.index,
                score: scored.score,
                text: scored.text,
                ingredients: extracted,
                ingredientCount: extracted.length
            });
        }
    }

    if (commentRecipes.length === 0) {
        console.warn("⚠️ No ingredients extracted from comments");
        return {
            found: false,
            reason: "No ingredients found in comments",
            ingredients: [],
            topComments: [],
            qualityScore: 0
        };
    }

    // STEP 5.4: Normalize and deduplicate
    console.log(`\n🔍 Step 5.3: Finding consensus recipe by comparing ${commentRecipes.length} recipes...`);
    
    let bestRecipe = null;
    let bestScore = 0;

    // Compare each recipe with others to find consensus
    for (let i = 0; i < commentRecipes.length; i++) {
        let consensusScore = 0;
        const recipe1 = commentRecipes[i];
        const recipe1Normalized = new Set(
            recipe1.ingredients.map(ing => normalizeIngredientNameForMatching(ing.name))
        );

        // Count how many other recipes have matching ingredients
        for (let j = 0; j < commentRecipes.length; j++) {
            if (i === j) continue;
            
            const recipe2 = commentRecipes[j];
            const recipe2Normalized = recipe2.ingredients.map(ing => 
                normalizeIngredientNameForMatching(ing.name)
            );

            // Count matching ingredients
            const matches = recipe2Normalized.filter(ing => recipe1Normalized.has(ing)).length;
            
            // Higher score if many ingredients match
            if (matches >= 5) {
                consensusScore += matches * 10;
                consensusScore += recipe2.score * 0.5; // Also consider comment score
            }
        }

        // Bonus for longer recipes (more ingredients)
        consensusScore += recipe1.ingredientCount * 2;
        
        // Bonus for high comment score
        consensusScore += recipe1.score * 2;

        console.log(`   Comment ${recipe1.commentIndex + 1}: Consensus score ${consensusScore}`);

        if (consensusScore > bestScore) {
            bestScore = consensusScore;
            bestRecipe = recipe1;
        }
    }

    if (!bestRecipe) {
        // Fallback: take the recipe from highest-scored comment
        console.log(`   ⚠️ No consensus found, using highest-scored comment`);
        commentRecipes.sort((a, b) => b.score - a.score);
        bestRecipe = commentRecipes[0];
    }

    // STEP 5.5: Calculate quality score
    console.log(`\n🔄 Normalizing ${bestRecipe.ingredients.length} ingredients from consensus recipe...`);
    
    const normalized = normalizeIngredients(bestRecipe.ingredients);
    
    console.log(`✅ Final count: ${normalized.length} unique ingredients`);
    console.log(`📝 Best recipe from Comment ${bestRecipe.commentIndex + 1} (Consensus Score: ${bestScore})`);

    // STEP 6: Calculate quality score
    const qualityScore = Math.min(100, Math.round(
        (normalized.length / 25) * 40 +          // Ingredient count (0-40)
        (bestRecipe.score / 100) * 30 +          // Comment quality (0-30)
        (bestScore / 500) * 30                   // Consensus strength (0-30)
    ));

    console.log(`📊 Mining quality score: ${qualityScore}/100\n`);

    return {
        found: true,
        ingredientCount: normalized.length,
        sourceCommentCount: 1,
        commentQuality: qualityScore,
        ingredients: normalized,
        topComments: [bestRecipe.text], // Only return the best recipe comment
        qualityScore: qualityScore,
        consensusScore: bestScore
    };
};


module.exports = {
    getYouTubeDescription,
    getYouTubeThumbnail,
    extractRecipeFromYoutube,
    fetchYouTubeComments,
    mineRecipeFromComments
};