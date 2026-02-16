const pool = require('../config/db');
const { extractFromDescription } = require('../services/descriptionExtractorService');
const { descriptionToRecipeService } = require('../services/recipeExtractionService');
const { logConversion, logConversionError } = require('../services/conversionLogger');

// __________-------------Extract Video ID from URL-------------__________
const extractVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
        /youtu\.be\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
};

// __________-------------Hybrid: Description-First Extraction (No Audio Needed)-------------__________
const extractYouTubeRecipeHybrid = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { videoUrl, userId = null } = req.body;

        if (!videoUrl) {
            return res.status(400).json({ 
                success: false,
                message: "Video URL is required"
            });
        }

        console.log("🎯 Starting YouTube recipe extraction from description...");

        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid YouTube URL",
                videoId: null
            });
        }

        console.log("✅ URL validated. Video ID:", videoId);

        // __________-------------STEP 1: Extract Description-------------__________
        console.log("📄 STEP 1: Fetching video description...");
        
        let descriptionData;
        try {
            descriptionData = await extractFromDescription(videoUrl);
        } catch (descError) {
            console.error("❌ Description extraction failed:", descError.message);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'youtube',
                source_url: videoUrl,
                status: 'description_extraction_failed',
                error_message: descError.message,
                processing_time_ms: Date.now() - startTime
            });

            return res.status(400).json({
                success: false,
                conversionId,
                message: "Could not fetch YouTube video description",
                error: descError.message,
                troubleshooting: [
                    "Ensure the video URL is valid and public",
                    "Check that the video is not age-restricted",
                    "Try a different video",
                    "Make sure your server has internet access"
                ]
            });
        }

        // __________-------------STEP 2: Check if description has recipe-------------__________
        console.log("📄 STEP 2: Analyzing description content...");
        
        if (!descriptionData.success || !descriptionData.ingredients || descriptionData.ingredients.length === 0) {
            console.log("⚠️ No recipe found in description");
            
            return res.status(400).json({
                success: false,
                message: "No recipe found in video description",
                description: descriptionData.description ? descriptionData.description.substring(0, 200) + '...' : null,
                troubleshooting: [
                    "This video doesn't appear to have recipe details in the description",
                    "Try a video with recipe ingredients listed in the description",
                    "Make sure the description includes ingredient quantities and units (cups, tbsp, grams, etc.)"
                ]
            });
        }

        console.log(`✅ Found ${descriptionData.ingredients.length} ingredients in description`);

        // __________-------------STEP 3: Use Groq to Structure Recipe-------------__________
        console.log("📤 STEP 3: Structuring recipe with Groq LLM...");
        
        let finalRecipe;
        try {
            const result = await descriptionToRecipeService(
                descriptionData.description,
                {
                    videoTitle: descriptionData.videoTitle,
                    channelName: descriptionData.channelName
                }
            );
            
            finalRecipe = result.recipe;

            console.log("✅ Recipe successfully extracted!");
            console.log(`   Ingredients: ${finalRecipe.ingredients.length}`);
            console.log(`   Steps: ${finalRecipe.steps.length}`);

        } catch (groqError) {
            console.error("❌ Recipe structuring failed:", groqError.message);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'youtube',
                source_url: videoUrl,
                video_title: descriptionData.videoTitle,
                transcript_text: descriptionData.description,
                status: 'recipe_structuring_failed',
                error_message: groqError.message,
                processing_time_ms: Date.now() - startTime
            });

            if (conversionId) {
                await logConversionError(conversionId, 'GroqError', groqError.message, 'recipe_structuring');
            }

            return res.status(500).json({
                success: false,
                conversionId,
                message: "Failed to structure recipe from description",
                error: groqError.message,
                suggestion: "Check your Groq API key and rate limits"
            });
        }

        // __________-------------STEP 4: Log Success and Return-------------__________
        conversionId = await logConversion({
            user_id: userId,
            source_type: 'youtube',
            source_url: videoUrl,
            video_title: descriptionData.videoTitle,
            transcript_text: descriptionData.description,
            recipe_json: finalRecipe,
            recipe_status: 'generated',
            status: 'recipe_generated_from_description',
            processing_time_ms: Date.now() - startTime
        });

        res.json({
            success: true,
            conversionId,
            recipe: finalRecipe,
            extractionPath: 'description',
            videoTitle: descriptionData.videoTitle,
            ingredientCount: finalRecipe.ingredients.length,
            stepCount: finalRecipe.steps.length,
            processingTime: Date.now() - startTime,
            message: "✅ Recipe successfully extracted from video description!"
        });

    } catch (error) {
        console.error("❌ Critical error in hybrid extraction:", error);
        
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

module.exports = {
    extractYouTubeRecipeHybrid,
    extractVideoId
};