const pool = require('../config/db');
const { transcriptToRecipeService } = require('../services/transcriptService');
const { logConversion } = require('../services/conversionLogger');

// Helper function to extract video ID from various YouTube URL formats
const extractVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;

    // Match various YouTube URL formats:
    // - https://www.youtube.com/watch?v=VIDEO_ID
    // - https://youtu.be/VIDEO_ID
    // - https://www.youtube.com/shorts/VIDEO_ID
    // - https://youtube.com/watch?v=VIDEO_ID
    // - youtube.com/watch?v=VIDEO_ID

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,  // Regular video
        /youtube\.com\/shorts\/([^&\n?#]+)/,  // YouTube Shorts
        /youtu\.be\/([^&\n?#]+)/,  // Short URL
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};

// __________-------------Extract YouTube Transcript-------------__________
const extractYouTubeTranscript = async (req, res) => {
    try {
        const { videoUrl } = req.body;

        if (!videoUrl) {
            return res.status(400).json({ message: "Video URL is required" });
        }

        console.log("🎬 Extracting YouTube transcript from:", videoUrl);

        // Extract Video ID from URL
        const videoId = extractVideoId(videoUrl);
        
        if (!videoId) {
            console.error("❌ Invalid YouTube URL format:", videoUrl);
            return res.status(400).json({ 
                message: "Invalid YouTube URL format. Supported formats:\n- https://www.youtube.com/watch?v=VIDEO_ID\n- https://youtu.be/VIDEO_ID\n- https://www.youtube.com/shorts/VIDEO_ID",
                receivedUrl: videoUrl
            });
        }

        console.log("✅ Video ID extracted:", videoId);

        try {
            // Import and use youtube-transcript
            const { YoutubeTranscript } = await import('youtube-transcript');
            
            console.log("📥 Fetching transcript for video ID:", videoId);
            const transcript = await YoutubeTranscript.fetchTranscript({
                videoId: videoId,
            });

            if (!transcript || transcript.length === 0) {
                throw new Error("No transcript found for this video");
            }

            const fullTranscript = transcript.map(item => item.text).join(' ');

            console.log("✅ Transcript extracted successfully. Length:", fullTranscript.length);

            // Log successful extraction
            await logConversion({
                source_type: 'youtube',
                source_url: videoUrl,
                transcript_text: fullTranscript,
                status: 'transcript_extracted',
            });

            res.json({
                success: true,
                transcript: fullTranscript,
                videoId: videoId,
                message: "✅ YouTube transcript extracted successfully"
            });

        } catch (transcriptError) {
            console.error("❌ Error extracting transcript:", transcriptError.message);
            
            await logConversion({
                source_type: 'youtube',
                source_url: videoUrl,
                status: 'transcript_extraction_failed',
                error_message: transcriptError.message,
            });

            // Provide helpful error message
            let errorMessage = "Could not extract transcript.";
            if (transcriptError.message.includes("No transcript")) {
                errorMessage = "This video doesn't have captions/subtitles available.";
            } else if (transcriptError.message.includes("Not found")) {
                errorMessage = "Video not found. Check the URL and try again.";
            } else if (transcriptError.message.includes("private")) {
                errorMessage = "This video is private or restricted.";
            }

            return res.status(400).json({
                message: errorMessage,
                error: transcriptError.message,
                videoId: videoId
            });
        }

    } catch (error) {
        console.error("❌ Error in extractYouTubeTranscript:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// __________-------------Convert Transcript to Recipe via Groq LLM-------------__________
const convertTranscriptToRecipe = async (req, res) => {
    try {
        const { transcript, videoUrl, source } = req.body;

        if (!transcript || transcript.trim().length === 0) {
            return res.status(400).json({ message: "Transcript is required" });
        }

        if (!source) {
            return res.status(400).json({ message: "Source (youtube/tiktok/instagram) is required" });
        }

        console.log(`🔄 Converting ${source} transcript to recipe using Groq...`);

        try {
            // Call Groq API through our service
            const recipeData = await transcriptToRecipeService(transcript);

            if (!recipeData || !recipeData.title) {
                throw new Error("LLM failed to generate recipe data");
            }

            console.log("✅ Recipe generated successfully");

            // Log successful conversion
            await logConversion({
                source_type: source,
                source_url: videoUrl || 'manual_paste',
                transcript_text: transcript,
                recipe_json: recipeData,
                status: 'recipe_generated',
                groq_api_response: recipeData,
            });

            res.json({
                success: true,
                recipe: recipeData,
                message: "✅ Recipe generated successfully"
            });

        } catch (llmError) {
            console.error("❌ LLM Error:", llmError.message);

            await logConversion({
                source_type: source,
                source_url: videoUrl || 'manual_paste',
                transcript_text: transcript,
                status: 'recipe_generation_failed',
                error_message: llmError.message,
            });

            return res.status(500).json({
                message: "Failed to generate recipe from transcript",
                error: llmError.message,
                suggestion: "Ensure your Groq API key is valid and you haven't exceeded rate limits (30 req/min, ~14,400 req/day)"
            });
        }

    } catch (error) {
        console.error("❌ Error in convertTranscriptToRecipe:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// __________-------------Map Ingredients to Database IDs-------------__________
const mapIngredientsToDatabase = async (req, res) => {
    try {
        const { ingredients } = req.body;

        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ message: "Ingredients array is required" });
        }

        const mappedIngredients = [];
        const unmappedIngredients = [];

        for (const ingredient of ingredients) {
            try {
                // Search for ingredient in database by name
                const result = await pool.query(
                    `SELECT id, name, form FROM ingredients WHERE LOWER(name) ILIKE $1 LIMIT 1`,
                    [`%${ingredient.name.toLowerCase()}%`]
                );

                if (result.rows.length > 0) {
                    const dbIngredient = result.rows[0];
                    mappedIngredients.push({
                        ...ingredient,
                        ingredientId: dbIngredient.id,
                        ingredientName: dbIngredient.name,
                        form: dbIngredient.form || "unknown",
                        mapped: true
                    });
                } else {
                    // Not found in database
                    unmappedIngredients.push({
                        ...ingredient,
                        mapped: false,
                        note: "Ingredient not found in database. Can be created manually."
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
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// __________-------------Get Conversion History (for debugging)-------------__________
const getConversionHistory = async (req, res) => {
    try {
        const { limit = 20, offset = 0, status } = req.query;

        let query = `SELECT * FROM transcript_conversions WHERE 1=1`;
        const values = [];

        if (status) {
            query += ` AND status = $${values.length + 1}`;
            values.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, values);

        res.json({
            success: true,
            conversions: result.rows,
            total: result.rows.length,
            limit,
            offset
        });

    } catch (error) {
        console.error("❌ Error fetching conversion history:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// __________-------------Get Conversion Details by ID-------------__________
const getConversionDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Conversion ID is required" });
        }

        const result = await pool.query(
            `SELECT * FROM transcript_conversions WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Conversion not found" });
        }

        res.json({
            success: true,
            conversion: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Error fetching conversion details:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    extractYouTubeTranscript,
    convertTranscriptToRecipe,
    mapIngredientsToDatabase,
    getConversionHistory,
    getConversionDetails
};