const pool = require('../config/db');
const {
    getYouTubeDescription,
    extractIngredientsFromText,
    analyzeDescriptionContent,
    generateRecipeWithLLM,
    normalizeUnit,
    getYouTubeThumbnail
} = require('../services/videoToRecipeService');
const {
    getTikTokMetadata,
    getTikTokThumbnail,
    analyzeTikTokDescription,
    validateTikTokUrl,
    extractRecipeFromCreatorWebsite
} = require('../services/tikTokService');
const { mineRecipeFromComments } = require('../services/youtubeCommentsService');
const { extractVideoId, detectPlatform } = require('../services/utils/videoUtils');
const { logConversion, logConversionError } = require('../services/conversionLogger');
// __________-------------Match ingredients with database-------------__________
const matchIngredientsWithDatabase = async (ingredients) => {
    try {
        console.log(`\n🔗 Matching ${ingredients.length} ingredients with database...`);
        
        const matched = [];
        const unmatched = [];
        
        for (const ingredient of ingredients) {
            const result = await matchSingleIngredient(ingredient);
            
            if (result.found) {
                matched.push(result);
                console.log(`   ✅ "${ingredient.name}" → "${result.dbName}"`);
            } else {
                unmatched.push(result);
                console.log(`   ⚠️ "${ingredient.name}" (will be created)`);
            }
        }
        
        console.log(`\n📊 Match Summary: ${matched.length} matched, ${unmatched.length} unmatched`);
        
        return {
            all: [...matched, ...unmatched],
            matched,
            unmatched,
            matchPercentage: Math.round((matched.length / ingredients.length) * 100)
        };
        
    } catch (error) {
        console.error("❌ Error matching ingredients:", error);
        throw error;
    }
};

// __________-------------Smart Ingredient Matching Function-------------__________
const matchSingleIngredient = async (ingredient) => {
    try {
        const searchName = ingredient.name.toLowerCase().trim();
        
        // Strategy 1: Exact case-insensitive match
        console.log(`   🔍 Searching for: "${searchName}"`);
        
        let result = await pool.query(
            `SELECT id, name FROM ingredients WHERE LOWER(TRIM(name)) = $1 LIMIT 1`,
            [searchName]
        );
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'exact'
            };
        }
        
        // Strategy 2: Partial/substring match (e.g., "eggs" matches "egg")
        console.log(`   🔍 Trying substring match...`);
        
        result = await pool.query(
            `SELECT id, name FROM ingredients 
             WHERE LOWER(name) LIKE $1 OR LOWER($2) LIKE '%' || LOWER(name) || '%'
             ORDER BY LENGTH(name) ASC
             LIMIT 1`,
            [`%${searchName}%`, searchName]
        );
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'partial'
            };
        }
        
        // Strategy 3: Fuzzy matching (remove common suffixes/prefixes)
        console.log(`   🔍 Trying fuzzy match...`);
        
        const cleanedName = cleanIngredientForMatching(searchName);
        
        result = await pool.query(
            `SELECT id, name FROM ingredients 
             WHERE LOWER(name) LIKE $1 OR LOWER(name) LIKE $2
             ORDER BY LENGTH(name) ASC
             LIMIT 1`,
            [`%${cleanedName}%`, `${cleanedName}%`]
        );
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'fuzzy'
            };
        }
        
        // Strategy 4: Similar ingredients (like "flour type 55" for "flour")
        console.log(`   🔍 Trying similar ingredient match...`);
        
        result = await pool.query(
            `SELECT id, name FROM ingredients 
             WHERE LOWER(name) LIKE $1
             ORDER BY 
               CASE 
                 WHEN LOWER(name) = $2 THEN 0
                 WHEN LOWER(name) LIKE $3 THEN 1
                 WHEN LOWER(name) LIKE $4 THEN 2
                 ELSE 3
               END,
               LENGTH(name) ASC
             LIMIT 1`,
            [
                `${searchName}%`,  // Starts with search name
                searchName,         // Exact match
                `${searchName}%`,   // Starts with search name (for "flour" -> "flour type 55")
                `%${searchName}%`   // Contains search name
            ]
        );
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'similar'
            };
        }
        
        // No match found - will be created
        return {
            ...ingredient,
            dbId: null,
            dbName: null,
            found: false,
            icon: '⚠️',
            matchType: 'none'
        };
        
    } catch (error) {
        console.error(`❌ Error matching ingredient "${ingredient.name}":`, error);
        
        // Return unmatched on error (don't fail the whole process)
        return {
            ...ingredient,
            dbId: null,
            dbName: null,
            found: false,
            icon: '⚠️',
            matchType: 'error'
        };
    }
};

// __________-------------Clean ingredient name for fuzzy matching-------------__________
const cleanIngredientForMatching = (name) => {
    return name
        .toLowerCase()
        .trim()
        // Remove plurals
        .replace(/s$/, '')
        // Remove common descriptors
        .replace(/\s*(type|variety|kind|grade|quality|premium|standard|raw|fresh|dried|cooked|roasted|all|purpose|ground)\s*/gi, '')
        // Remove numbers and types (like "type 55")
        .replace(/\s*\d+\s*/g, '')
        // Remove extra spaces
        .replace(/\s+/g, ' ')
        .trim();
};

// __________-------------Main Endpoint: Extract Recipe from Video-------------__________
const extractRecipeFromVideo = async (req, res) => {
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
        
        if (extractedIngredients.length < 4 && process.env.YOUTUBE_API_KEY) {
            try {
                // Fetch comments first
                const { fetchYouTubeComments } = require('../services/youtubeCommentsService');
                const allComments = await fetchYouTubeComments(videoId);

                if (allComments.length > 0) {
                    // Mine for recipe
                    const minedData = mineRecipeFromComments(allComments);
                    
                    if (minedData.found && minedData.ingredients.length > 0) {
                        console.log(`✅ Mined ${minedData.ingredients.length} ingredients from ${minedData.sourceCommentCount} comments`);
                        console.log(`   Quality Score: ${minedData.qualityScore}/100`);
                        
                        // Store top comments for LLM reference
                        if (minedData.topComments && minedData.topComments.length > 0) {
                            topCommentsText = minedData.topComments.slice(0, 5).join('\n\n---\n\n');
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
        } else if (extractedIngredients.length >= 4) {
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

// __________-------------Main Endpoint: Extract Recipe from TikTok Video-------------__________
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
        
        // Check if this URL has been processed before
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

        // Step 1: Validate TikTok URL
        console.log("📼 Step 1: Validating TikTok URL...");
        const urlValidation = validateTikTokUrl(videoUrl);
        
        if (!urlValidation.isValid) {
            console.log(`❌ Invalid TikTok URL: ${urlValidation.error}`);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'tiktok',
                source_url: videoUrl,
                status: 'url_validation_failed',
                error_message: urlValidation.error,
                processing_time_ms: Date.now() - startTime
            });

            return res.status(400).json({
                success: false,
                conversionId,
                message: "Invalid TikTok URL format",
                error: urlValidation.error,
                supportedFormats: [
                    'https://www.tiktok.com/@username/video/VIDEO_ID',
                    'https://vt.tiktok.com/shortcode',
                    'https://m.tiktok.com/@username/video/VIDEO_ID'
                ]
            });
        }

        const videoId = urlValidation.videoId;
        console.log(`✅ Valid TikTok URL. Video ID: ${videoId}`);

        // Step 2: Fetch TikTok metadata
        console.log("\n📼 Step 2: Fetching TikTok metadata...");
        let tikTokMetadata;
        let videoThumbnail = null;
        
        try {
            tikTokMetadata = await getTikTokMetadata(videoUrl);
            videoThumbnail = getTikTokThumbnail(videoId, tikTokMetadata.thumbnail);
            console.log(`✅ Title: "${tikTokMetadata.title}"`);
            console.log(`✅ Creator: @${tikTokMetadata.creator}`);
            console.log(`✅ Description length: ${tikTokMetadata.description?.length || 0} characters`);
            console.log(`✅ Thumbnail: ${videoThumbnail ? '✓' : '✗'}`);
        } catch (metadataError) {
            console.warn(`⚠️ TikTok metadata fetch failed: ${metadataError.message}`);
            console.log("⚠️ User will be prompted to manually enter transcript");
            
            // Log but don't fail - allow fallback to manual input
            await logConversion({
                user_id: userId,
                source_type: 'tiktok',
                source_url: videoUrl,
                status: 'metadata_fetch_failed',
                error_message: metadataError.message,
                processing_time_ms: Date.now() - startTime
            });

            return res.status(400).json({
                success: false,
                requiresManualInput: true,
                message: "Could not automatically fetch TikTok video data",
                error: metadataError.message,
                suggestion: "Please paste the video description or transcript manually below",
                supportedFormats: [
                    'https://www.tiktok.com/@username/video/VIDEO_ID',
                    'https://vt.tiktok.com/shortcode'
                ]
            });
        }

        // Step 3: Analyze description
        console.log("\n📼 Step 3: Analyzing description content...");
        const analysis = analyzeTikTokDescription(tikTokMetadata.description);
        console.log(`   - Has ingredients: ${analysis.hasIngredients}`);
        console.log(`   - Has steps: ${analysis.hasSteps}`);
        console.log(`   - Total lines: ${analysis.lineCount}`);

        // Step 4: Extract ingredients
        console.log("\n📼 Step 4: Extracting ingredients from description...");
        let extractedIngredients = extractIngredientsFromText(tikTokMetadata.description);
        console.log(`✅ Extracted ${extractedIngredients.length} ingredients from description`);

         // Step 5: Try to find recipe on creator's website if description is sparse
        console.log("\n📼 Step 5: Checking for recipe on creator's website...");
        let websiteRecipeContent = "";
        
        // Only try to find website recipe if we have very few ingredients
        if (extractedIngredients.length < 3) {
            console.log("⚠️ Sparse ingredients detected, searching for creator's website...");
            
            try {
                const { extractRecipeFromCreatorWebsite } = require('../services/tikTokService');
                const websiteContent = await extractRecipeFromCreatorWebsite(
                    tikTokMetadata.description,
                    tikTokMetadata.creator
                );
                
                if (websiteContent) {
                    console.log(`✅ Found recipe content on creator website`);
                    websiteRecipeContent = websiteContent;
                    
                    // Try to extract ingredients from website content
                    const websiteIngredients = extractIngredientsFromText(websiteContent);
                    if (websiteIngredients.length > 0) {
                        console.log(`✅ Extracted ${websiteIngredients.length} additional ingredients from website`);
                        extractedIngredients = mergeIngredients(extractedIngredients, websiteIngredients);
                    }
                } else {
                    console.log("⚠️ No recipe found on creator website, continuing with description only");
                }
            } catch (websiteError) {
                console.warn(`⚠️ Website scraping failed (continuing): ${websiteError.message}`);
            }
        } else {
            console.log("✅ Sufficient ingredients found, skipping website search");
        }

                // Step 6: Generate recipe with LLM
        console.log("\n📼 Step 6: Generating recipe with Groq LLM...");
        let finalRecipe;
        try {
            const response = await generateRecipeWithLLM(
                tikTokMetadata.description,
                tikTokMetadata.title,
                tikTokMetadata.creator,
                extractedIngredients
            );
            
            // ✅ FIX: Handle response properly
            finalRecipe = response.recipe || response;
            
            if (!finalRecipe || !finalRecipe.title) {
                throw new Error("Invalid recipe data received from LLM");
            }
            
            console.log(`✅ Recipe generated successfully`);
            console.log(`   - Ingredients: ${finalRecipe.ingredients.length}`);
            console.log(`   - Steps: ${finalRecipe.steps.length}`);
        } catch (groqError) {
            console.error("\n❌ LLM Error:", groqError.message);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'tiktok',
                source_url: videoUrl,
                video_title: tikTokMetadata.title,
                transcript_text: tikTokMetadata.description,
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
                message: "Failed to generate recipe from TikTok video",
                error: groqError.message
            });
        }

        // Step 7: Match ingredients with database
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

        // Step 8: Log conversion
        console.log("\n📼 Step 8: Logging conversion to database...");
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
            ingredientMatches: ingredientMatches,
            videoTitle: tikTokMetadata.title,
            creator: tikTokMetadata.creator,
            videoThumbnail: videoThumbnail,
            processingTime: Date.now() - startTime,
            message: "✅ Recipe extracted from TikTok successfully!"
        });

    } catch (error) {
        console.error("\n❌ CRITICAL ERROR:", error.message);
        
        if (conversionId) {
            await logConversionError(conversionId, 'CriticalError', error.message, 'extraction');
        }

        res.status(500).json({
            success: false,
            conversionId,
            message: "Server error during TikTok recipe extraction",
            error: error.message
        });
    }
};

// __________-------------Merge ingredients from multiple sources-------------__________
const mergeIngredients = (descriptionIngredients, minedIngredients) => {
    const merged = [...descriptionIngredients];
    const existingNames = new Set(merged.map(ing => ing.name.toLowerCase().trim()));

    for (const minedIng of minedIngredients) {
        const normalizedName = minedIng.name.toLowerCase().trim();
        if (!existingNames.has(normalizedName)) {
            merged.push({
                name: minedIng.name,
                quantity: minedIng.quantity,
                unit: minedIng.unit,
                section: minedIng.section || 'Main'
            });
            existingNames.add(normalizedName);
        }
    }

    return merged;
};

// __________-------------Save Recipe from Video to Database-------------__________
const saveRecipeFromVideo = async (req, res) => {
    console.log("\n💾 ========== SAVING RECIPE TO DATABASE ==========");
    try {
        const { generatedRecipe, conversionId, userId = null, videoThumbnail = null } = req.body;
        console.log(`📸 Thumbnail received: ${videoThumbnail ? 'Yes ✅' : 'No ❌'}`);
        console.log(`📸 Thumbnail URL: ${videoThumbnail || 'null'}`);

        if (!generatedRecipe || !generatedRecipe.title) {
            return res.status(400).json({ success: false, message: "Valid recipe data is required" });
        }

        const {
            title,
            steps,
            notes,
            prep_time,
            cook_time,
            difficulty,
            ingredients,
            course_type,
            meal_type,
            cuisine_type,
            servings,
            source
        } = generatedRecipe;

        if (!title || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ success: false, message: "Title and steps are required" });
        }

        console.log(`📝 Saving recipe: "${title}"`);
        console.log(`   Ingredients: ${ingredients?.length || 0}`);
        console.log(`   Steps: ${steps.length}`);
        console.log(`   Thumbnail: ${videoThumbnail || 'None'}`);

        const total_time = (parseInt(prep_time) || 0) + (parseInt(cook_time) || 0) || null;

        // Fetch the source URL from the conversion record if available
        let sourceUrl = source || 'video_conversion';
        if (conversionId) {
            try {
                const conversionResult = await pool.query(
                    `SELECT source_url FROM transcript_conversions WHERE id = $1`,
                    [conversionId]
                );
                if (conversionResult.rows.length > 0 && conversionResult.rows[0].source_url) {
                    sourceUrl = conversionResult.rows[0].source_url;
                }
            } catch (err) {
                console.warn("Could not fetch source URL from conversion:", err.message);
            }
        }

        console.log(`🔍 Inserting recipe with thumbnail: ${videoThumbnail || 'null'}`);

        // Insert recipe WITH thumbnail URL
        const recipeResult = await pool.query(
            `INSERT INTO recipes (title, steps, notes, prep_time, cook_time, total_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source, portions, thumbnail_url)
            VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
            RETURNING id`,
            [
                title,
                JSON.stringify(steps),
                notes || null,
                parseInt(prep_time) || null,
                parseInt(cook_time) || null,
                total_time,
                difficulty || 'Medium',
                course_type || 'Main Course',
                meal_type || 'Dinner',
                cuisine_type || 'Homemade',
                false,
                sourceUrl,
                servings || null,
                videoThumbnail || null 
            ]
        );

        const recipeId = recipeResult.rows[0].id;
        const savedThumbnail = recipeResult.rows[0].thumbnail_url;
        
        console.log(`✅ Recipe inserted with ID: ${recipeId}`);
        console.log(`✅ Thumbnail saved: ${savedThumbnail || 'None'}`);

        let savedCount = 0;
        if (ingredients && ingredients.length > 0) {
            console.log(`🔗 Linking ${ingredients.length} ingredients...`);
            for (const ingredient of ingredients) {
                if (!ingredient.name || ingredient.name.trim().length === 0) continue;

                let ingredientId;
                const existingResult = await pool.query(
                    `SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1)`,
                    [ingredient.name]
                );

                if (existingResult.rows.length > 0) {
                    ingredientId = existingResult.rows[0].id;
                } else {
                    const newIngredientResult = await pool.query(
                        `INSERT INTO ingredients (name) VALUES ($1) RETURNING id`,
                        [ingredient.name]
                    );
                    ingredientId = newIngredientResult.rows[0].id;
                }

                if (ingredientId) {
                    const normalizedUnit = normalizeUnit(ingredient.unit) || ingredient.unit;
                    await pool.query(
                        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, section)
                        VALUES ($1, $2, $3, $4, $5)`,
                        [recipeId, ingredientId, ingredient.quantity || null, normalizedUnit, ingredient.section || 'Main']
                    );
                    savedCount++;
                }
            }
        }

        console.log(`✅ ${savedCount} ingredients linked`);

        // Update conversion status
        if (conversionId) {
            await pool.query(
                `UPDATE transcript_conversions SET recipe_status = $1, status = $2, updated_at = NOW() 
                 WHERE id = $3`,
                ['saved', 'recipe_saved', conversionId]
            );
        }

        res.json({
            success: true,
            message: "✅ Recipe saved successfully!",
            recipeId,
            conversionId
        });

    } catch (error) {
        console.error("❌ Error saving recipe:", error);
        
        if (req.body?.conversionId) {
            try {
                const { logConversionError } = require('../services/conversionLogger');
                await logConversionError(
                    req.body.conversionId,
                    'RecipeSaveError',
                    error.message,
                    'recipe_save'
                );
            } catch (logErr) {
                console.error("Could not log error:", logErr.message);
            }
        }

        res.status(500).json({
            success: false,
            message: "Error saving recipe",
            error: error.message
        });
    }
};

module.exports = {
    extractRecipeFromVideo,
    extractRecipeFromTikTok,
    saveRecipeFromVideo,
    matchIngredientsWithDatabase
};