const pool = require('../config/db');
const {
    getYouTubeDescription,
    extractIngredientsFromText,
    analyzeDescriptionContent,
    generateRecipeWithLLM
} = require('../services/videoToRecipeService');
const { logConversion, logConversionError } = require('../services/conversionLogger');

const extractVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
    return match ? match[1] : null;
};

// __________-------------Main Endpoint: Resilient Recipe Extraction-------------__________
const extractRecipeFromVideo = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { videoUrl, userId = null } = req.body;

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

        // Step 2: Fetch YouTube metadata
        console.log("\n📼 Step 2: Fetching YouTube metadata...");
        let youtubeMetadata;
        try {
            youtubeMetadata = await getYouTubeDescription(videoUrl);
            console.log(`✅ Title: "${youtubeMetadata.title}"`);
            console.log(`✅ Description length: ${youtubeMetadata.description?.length || 0} characters`);
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

        // Step 3: Analyze what data we have
        console.log("\n📼 Step 3: Analyzing description content...");
        const analysis = analyzeDescriptionContent(youtubeMetadata.description);
        console.log(`   - Has ingredients: ${analysis.hasIngredients}`);
        console.log(`   - Has steps: ${analysis.hasSteps}`);
        console.log(`   - Ingredient units found: ${analysis.ingredientCount}`);
        console.log(`   - Total lines: ${analysis.lineCount}`);

        // Step 4: Extract ingredients from text
        console.log("\n📼 Step 4: Extracting ingredients from description...");
        const extractedIngredients = extractIngredientsFromText(youtubeMetadata.description);
        console.log(`✅ Extracted ${extractedIngredients.length} ingredients`);
        if (extractedIngredients.length > 0) {
            extractedIngredients.slice(0, 3).forEach(ing => {
                console.log(`   - ${ing.quantity} ${ing.unit} ${ing.name} (${ing.section})`);
            });
            if (extractedIngredients.length > 3) {
                console.log(`   ... and ${extractedIngredients.length - 3} more`);
            }
        }

        // Step 5: Use LLM to generate complete recipe
        console.log("\n📼 Step 5: Generating complete recipe with Groq LLM...");
        console.log("   - Using all available data (title, description, extracted ingredients)");
        console.log("   - LLM will infer missing steps using expert baking knowledge");
        
        let finalRecipe;
        try {
            finalRecipe = await generateRecipeWithLLM(
                youtubeMetadata.description,
                youtubeMetadata.title,
                youtubeMetadata.channelTitle,
                extractedIngredients
            );
            
            console.log(`\n✅ RECIPE GENERATED SUCCESSFULLY!`);
            console.log(`   Title: "${finalRecipe.title}"`);
            console.log(`   Ingredients: ${finalRecipe.ingredients.length}`);
            console.log(`   Steps: ${finalRecipe.steps.length}`);
            console.log(`   Baking temp: ${finalRecipe.baking_temperature}°F`);
            console.log(`   Baking time: ${finalRecipe.baking_time} minutes`);
            
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

        // Step 6: Log success
        console.log("\n📼 Step 6: Logging conversion to database...");
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
            videoTitle: youtubeMetadata.title,
            channelTitle: youtubeMetadata.channelTitle,
            ingredientCount: finalRecipe.ingredients.length,
            stepCount: finalRecipe.steps.length,
            processingTime: Date.now() - startTime,
            message: "✅ Recipe successfully extracted from video!"
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

        // Validate
        if (!title || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ success: false, message: "Title and steps are required" });
        }

        console.log(`📝 Saving recipe: "${title}"`);
        console.log(`   Ingredients: ${ingredients?.length || 0}`);
        console.log(`   Steps: ${steps.length}`);

        const total_time = (parseInt(prep_time) || 0) + (parseInt(cook_time) || 0) || null;

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
                source || 'video_conversion',
                servings || null
            ]
        );

        const recipeId = recipeResult.rows[0].id;
        console.log(`✅ Recipe inserted with ID: ${recipeId}`);

        // Insert ingredients
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
                    await pool.query(
                        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                        VALUES ($1, $2, $3, $4)`,
                        [recipeId, ingredientId, ingredient.quantity || null, ingredient.unit || null]
                    );
                }
            }
            console.log(`✅ All ingredients linked`);
        }

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
            message: "Recipe saved successfully!",
            recipeId,
            conversionId,
            recipe: {
                id: recipeId,
                title,
                ingredientCount: ingredients ? ingredients.length : 0,
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
    extractVideoId
};