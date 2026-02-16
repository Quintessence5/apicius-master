const pool = require('../config/db');
const { transcriptToRecipeService } = require('../services/transcriptService');
const { logConversion, logConversionError } = require('../services/conversionLogger');
const { getYouTubeTranscript } = require('../services/youtubeAudioService');

// __________-------------Extract Video ID-------------__________
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

// __________-------------Extract YouTube Transcript with Enhanced Error Handling-------------__________
const extractYouTubeTranscript = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { videoUrl, userId = null } = req.body;

        if (!videoUrl) {
            return res.status(400).json({ 
                message: "Video URL is required",
                success: false
            });
        }

        console.log("🎬 Starting YouTube audio extraction and transcription...");

        // Validate URL format
        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid YouTube URL format",
                supportedFormats: [
                    "https://www.youtube.com/watch?v=VIDEO_ID",
                    "https://youtu.be/VIDEO_ID",
                    "https://www.youtube.com/shorts/VIDEO_ID"
                ],
                receivedUrl: videoUrl
            });
        }

        console.log("✅ URL validated. Video ID:", videoId);

        try {
            // Download audio and transcribe
            const result = await getYouTubeTranscript(videoUrl);

            console.log("✅ Transcript extracted successfully");

            // Log successful extraction
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'youtube',
                source_url: videoUrl,
                video_title: result.videoTitle || null,
                video_duration: result.duration || null,
                transcript_text: result.transcript,
                status: 'transcript_extracted',
                processing_time_ms: Date.now() - startTime
            });

            res.json({
                success: true,
                conversionId,
                transcript: result.transcript,
                videoId: videoId,
                videoTitle: result.videoTitle,
                duration: result.duration,
                method: 'audio-download-and-transcribe',
                processingTime: Date.now() - startTime,
                message: "✅ YouTube audio downloaded and transcribed"
            });

        } catch (transcriptError) {
            console.error("❌ Error in audio extraction/transcription:", transcriptError.message);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'youtube',
                source_url: videoUrl,
                status: 'transcript_extraction_failed',
                error_message: transcriptError.message,
                processing_time_ms: Date.now() - startTime
            });

            if (conversionId) {
                await logConversionError(conversionId, 'ExtractionError', transcriptError.message, 'extraction');
            }

            return res.status(400).json({
                success: false,
                conversionId,
                message: "Could not extract and transcribe audio",
                error: transcriptError.message,
                videoId: videoId,
                troubleshooting: [
                    "Ensure the YouTube URL is valid and public",
                    "Check that the video has audio content",
                    "Try a different video with better audio quality",
                    "Make sure your server can access YouTube",
                    "Check AssemblyAI or Puter API keys"
                ]
            });
        }

    } catch (error) {
        console.error("❌ Critical error in extractYouTubeTranscript:", error);
        
        if (conversionId) {
            await logConversionError(conversionId, 'CriticalError', error.message, 'extraction');
        }

        res.status(500).json({ 
            success: false,
            conversionId,
            message: "Server error during transcript extraction",
            error: error.message 
        });
    }
};

// __________-------------Convert Transcript to Recipe via Groq LLM with Better Validation-------------__________
const convertTranscriptToRecipe = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { transcript, videoUrl, source, userId = null, videoTitle = null, videoDescription = null, channelName = null } = req.body;

        // Validation
        if (!transcript || transcript.trim().length === 0) {
            return res.status(400).json({ 
                success: false,
                message: "Transcript is required and cannot be empty" 
            });
        }

        if (!source || !['youtube', 'tiktok', 'instagram', 'manual'].includes(source)) {
            return res.status(400).json({ 
                success: false,
                message: "Valid source is required (youtube, tiktok, instagram, or manual)" 
            });
        }

        console.log(`🔄 Converting ${source} transcript to recipe using Groq...`);

        try {
            // Call Groq API through our service with metadata
            const { recipe: recipeData, processingTime, rawResponse } = await transcriptToRecipeService(
                transcript,
                { videoTitle, videoDescription, channelName }
            );

            if (!recipeData || !recipeData.title) {
                throw new Error("LLM failed to generate valid recipe data");
            }

            console.log("✅ Recipe generated successfully");

            // Log successful conversion
            conversionId = await logConversion({
                user_id: userId,
                source_type: source,
                source_url: videoUrl || null,
                video_title: videoTitle || null,
                transcript_text: transcript,
                recipe_json: recipeData,
                recipe_status: 'generated',
                status: 'recipe_generated',
                groq_api_response: rawResponse,
                processing_time_ms: processingTime
            });

            res.json({
                success: true,
                conversionId,
                recipe: recipeData,
                processingTime,
                message: "✅ Recipe generated and validated successfully"
            });

        } catch (llmError) {
            console.error("❌ LLM Error:", llmError.message);

            conversionId = await logConversion({
                user_id: userId,
                source_type: source,
                source_url: videoUrl || null,
                transcript_text: transcript,
                status: 'recipe_generation_failed',
                error_message: llmError.message,
                recipe_status: 'failed',
                processing_time_ms: Date.now() - startTime
            });

            if (conversionId) {
                await logConversionError(conversionId, 'LLMError', llmError.message, 'recipe_generation');
            }

            return res.status(500).json({
                success: false,
                conversionId,
                message: "Failed to generate recipe from transcript",
                error: llmError.message,
                suggestion: "Check Groq API key and rate limits (30 req/min)"
            });
        }

    } catch (error) {
        console.error("❌ Error in convertTranscriptToRecipe:", error);
        
        if (conversionId) {
            await logConversionError(conversionId, 'CriticalError', error.message, 'recipe_generation');
        }

        res.status(500).json({ 
            success: false,
            conversionId,
            message: "Server error during recipe conversion",
            error: error.message 
        });
    }
};

// __________-------------Map Ingredients to Database IDs (Enhanced)-------------__________
const mapIngredientsToDatabase = async (req, res) => {
    try {
        const { ingredients, userId = null } = req.body;

        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: "Ingredients array is required and cannot be empty" 
            });
        }

        const mappedIngredients = [];
        const unmappedIngredients = [];

        for (const ingredient of ingredients) {
            try {
                // Search for ingredient in database by name (case-insensitive partial match)
                const result = await pool.query(
                    `SELECT id, name, form FROM ingredients 
                     WHERE LOWER(name) ILIKE $1 
                     ORDER BY similarity(LOWER(name), LOWER($2)) DESC
                     LIMIT 1`,
                    [`%${ingredient.name.toLowerCase()}%`, ingredient.name.toLowerCase()]
                );

                if (result.rows.length > 0) {
                    const dbIngredient = result.rows[0];
                    mappedIngredients.push({
                        ...ingredient,
                        ingredientId: dbIngredient.id,
                        ingredientName: dbIngredient.name,
                        form: dbIngredient.form || "unknown",
                        mapped: true,
                        confidence: "high"
                    });
                } else {
                    unmappedIngredients.push({
                        ...ingredient,
                        mapped: false,
                        note: "Ingredient not found in database. Can be created manually during recipe save."
                    });
                }
            } catch (err) {
                console.error(`❌ Error mapping ingredient "${ingredient.name}":`, err);
                unmappedIngredients.push({
                    ...ingredient,
                    mapped: false,
                    error: err.message
                });
            }
        }

        res.json({
            success: true,
            mappedIngredients,
            unmappedIngredients,
            mappingStats: {
                total: ingredients.length,
                mapped: mappedIngredients.length,
                unmapped: unmappedIngredients.length,
                mappingPercentage: Math.round((mappedIngredients.length / ingredients.length) * 100)
            }
        });

    } catch (error) {
        console.error("❌ Error in mapIngredientsToDatabase:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error during ingredient mapping",
            error: error.message 
        });
    }
};

// __________-------------Get Conversion History with Advanced Filtering-------------__________
const getConversionHistory = async (req, res) => {
    try {
        const { userId, limit = 20, offset = 0, status, source_type, dateFrom, dateTo } = req.query;

        let query = `SELECT * FROM transcript_conversions WHERE 1=1`;
        const values = [];
        let paramIndex = 1;

        // User filter
        if (userId) {
            query += ` AND user_id = $${paramIndex}`;
            values.push(parseInt(userId));
            paramIndex++;
        }

        // Status filter
        if (status) {
            query += ` AND status = $${paramIndex}`;
            values.push(status);
            paramIndex++;
        }

        // Source type filter
        if (source_type) {
            query += ` AND source_type = $${paramIndex}`;
            values.push(source_type);
            paramIndex++;
        }

        // Date range filter
        if (dateFrom) {
            query += ` AND created_at >= $${paramIndex}`;
            values.push(new Date(dateFrom));
            paramIndex++;
        }

        if (dateTo) {
            query += ` AND created_at <= $${paramIndex}`;
            values.push(new Date(dateTo));
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, values);

        res.json({
            success: true,
            conversions: result.rows,
            count: result.rows.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error("❌ Error fetching conversion history:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error fetching history",
            error: error.message 
        });
    }
};

// __________-------------Get Conversion Details by ID-------------__________
const getConversionDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ 
                success: false,
                message: "Valid conversion ID is required" 
            });
        }

        const result = await pool.query(
            `SELECT * FROM transcript_conversions WHERE id = $1`,
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: "Conversion not found" 
            });
        }

        res.json({
            success: true,
            conversion: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Error fetching conversion details:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error",
            error: error.message 
        });
    }
};

module.exports = {
    extractYouTubeTranscript,
    convertTranscriptToRecipe,
    mapIngredientsToDatabase,
    getConversionHistory,
    getConversionDetails,
    extractVideoId
};