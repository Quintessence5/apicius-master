const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const {
    getYouTubeDescription,
    extractIngredientsFromText,
    analyzeDescriptionContent,
    generateRecipeWithLLM,
    normalizeUnit,
    getYouTubeThumbnail
} = require('../services/videoToRecipeService');
const { logConversion, logConversionError } = require('../services/conversionLogger');

const extractVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
    return match ? match[1] : null;
};

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
        .replace(/\s*(type|variety|kind|grade|quality|premium|standard|raw|fresh|dried|cooked|roasted|ground)\s*/gi, '')
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
        // Step 0: Check if this URL has been processed before
console.log("\n📼 Step 0: Checking cache for previous conversions...");
const cachedConversion = await pool.query(
    `SELECT id, recipe_json, video_thumbnail_url, status FROM transcript_conversions 
     WHERE source_url = $1 AND status = 'recipe_generated' 
     ORDER BY created_at DESC LIMIT 1`,
    [videoUrl]
);

if (cachedConversion.rows.length > 0) {
    console.log(`✅ Found cached conversion! ID: ${cachedConversion.rows[0].id}`);
    const cached = cachedConversion.rows[0];
    
    return res.json({
        success: true,
        conversionId: cached.id,
        recipe: cached.recipe_json,
        ingredientMatches: {
            all: cached.recipe_json.ingredients || [],
            matched: cached.recipe_json.ingredients || [],
            unmatched: [],
            matchPercentage: 100
        },
        videoThumbnail: cached.video_thumbnail_url,
        processingTime: 0,
        message: "✅ Recipe retrieved from cache! (Previously processed)",
        fromCache: true
    });
}

        if (!videoUrl) {
            return res.status(400).json({ success: false, message: "Video URL is required" });
        }

        console.log("\n🎬 ========== STARTING RECIPE EXTRACTION ==========");
        console.log("📼 Step 1: Validating URL...");
        
        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({ success: false, message: "Invalid YouTube URL format" });
        }
        console.log(`✅ Valid URL. Video ID: ${videoId}`);

        // Fetch metadata
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

        // Analyze content
        console.log("\n📼 Step 3: Analyzing description content...");
        const analysis = analyzeDescriptionContent(youtubeMetadata.description);
        console.log(`   - Has ingredients: ${analysis.hasIngredients}`);
        console.log(`   - Has steps: ${analysis.hasSteps}`);
        console.log(`   - Total lines: ${analysis.lineCount}`);

        // Extract ingredients
        console.log("\n📼 Step 4: Extracting ingredients from description...");
        const extractedIngredients = extractIngredientsFromText(youtubeMetadata.description);
        console.log(`✅ Extracted ${extractedIngredients.length} ingredients`);
        try {
    youtubeMetadata = await getYouTubeDescription(videoUrl);
    videoThumbnail = getYouTubeThumbnail(videoId);
} catch (error) {
    conversionId = await logConversion({
        user_id: userId,
        source_type: 'youtube',
        source_url: videoUrl,
        status: 'metadata_fetch_failed',
        error_message: error.message,
        processing_time_ms: Date.now() - startTime
    });
    
    // Log the specific error
    await logConversionError(conversionId, 'MetadataFetchError', error.message, 'metadata_fetch');
    
    return res.status(400).json({
        success: false,
        conversionId,
        message: "Failed to fetch video metadata"
    });
}

        // Generate recipe with LLM
        console.log("\n📼 Step 5: Generating complete recipe with Groq LLM...");
        let finalRecipe;
        try {
            finalRecipe = await generateRecipeWithLLM(
                youtubeMetadata.description,
                youtubeMetadata.title,
                youtubeMetadata.channelTitle,
                extractedIngredients
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

        // Match ingredients with database (NON-BLOCKING - always succeeds)
        console.log("\n📼 Step 6: Matching ingredients with database...");
        let ingredientMatches;
        try {
            ingredientMatches = await matchIngredientsWithDatabase(finalRecipe.ingredients);
        } catch (matchError) {
            console.warn("⚠️ Ingredient matching error (continuing anyway):", matchError.message);
            // Don't fail here - create a basic match response
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

        // Log conversion
        console.log("\n📼 Step 7: Logging conversion to database...");
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

        // ALWAYS RESPOND WITH SUCCESS - let user proceed to review page
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

// __________-------------Save Recipe from Video to Database-------------__________
const saveRecipeFromVideo = async (req, res) => {
    console.log("\n💾 ========== SAVING RECIPE TO DATABASE ==========");
    try {
        const { generatedRecipe, conversionId, userId = null } = req.body;

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

        // Insert recipe
        // Insert recipe
        const recipeResult = await pool.query(
            `INSERT INTO recipes (title, steps, notes, prep_time, cook_time, total_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source, portions)
            VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
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
                cuisine_type || null,
                false,
                sourceUrl,
                servings || null
            ]
        );

        const recipeId = recipeResult.rows[0].id;
        console.log(`✅ Recipe inserted with ID: ${recipeId}`);

        // Insert ingredients
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
                    console.log(`   ✅ Linked existing: "${ingredient.name}"`);
                } else {
                    const newIngredientResult = await pool.query(
                        `INSERT INTO ingredients (name) VALUES ($1) RETURNING id`,
                        [ingredient.name]
                    );
                    ingredientId = newIngredientResult.rows[0].id;
                    console.log(`   ✨ Created new: "${ingredient.name}"`);
                }

                if (ingredientId) {
                    const normalizedUnit = normalizeUnit(ingredient.unit) || ingredient.unit;
                    // Include section if available
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
                `UPDATE transcript_conversions 
                SET recipe_status = 'saved', updated_at = CURRENT_TIMESTAMP 
                WHERE id = $1`,
                [conversionId]
            );
            console.log(`✅ Conversion status updated to 'saved'`);
        }

        console.log("\n💾 ========== SAVE COMPLETE ==========\n");

        res.status(201).json({
            success: true,
            message: "✅ Recipe saved successfully!",
            recipeId,
            conversionId,
            recipe: {
                id: recipeId,
                title,
                ingredientCount: savedCount,
                stepCount: steps.length
            }
        });

    } catch (error) {
        console.error("❌ Error saving recipe:", error);
        res.status(500).json({ success: false, message: "Error saving recipe", error: error.message });
    }
};

module.exports = {
    extractRecipeFromVideo,
    saveRecipeFromVideo,
    matchIngredientsWithDatabase,
    extractVideoId
};