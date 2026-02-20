const ytdl = require('ytdl-core');
const axios = require('axios');
const { Readable } = require('stream');
const { transcriptToRecipeService } = require('../services/transcriptService');
const { logConversion, logConversionError } = require('../services/conversionLogger');
const { getYouTubeTranscript } = require('../services/youtubeAudioService');
const { extractVideoId } = require('../services/utils/videoUtils');

// __________-------------Download Audio from YouTube as Buffer-------------__________
const downloadYouTubeAudio = async (videoUrl) => {
    try {
        console.log("🎬 Downloading audio from:", videoUrl);

        // Get video info first to validate URL
        const info = await ytdl.getInfo(videoUrl);
        console.log("✅ Video found:", info.videoDetails.title);

        // Download audio stream
        const audioStream = ytdl(videoUrl, {
            quality: 'highestaudio',
        });

        // Collect audio data into buffer
        const chunks = [];
        
        return new Promise((resolve, reject) => {
            audioStream.on('data', chunk => {
                chunks.push(chunk);
            });

            audioStream.on('end', () => {
                const audioBuffer = Buffer.concat(chunks);
                console.log("✅ Audio downloaded. Size:", audioBuffer.length, "bytes");
                resolve({
                    buffer: audioBuffer,
                    title: info.videoDetails.title,
                    duration: info.videoDetails.lengthSeconds
                });
            });

            audioStream.on('error', (err) => {
                console.error("❌ Error downloading audio:", err.message);
                reject(new Error(`Failed to download audio: ${err.message}`));
            });
        });

    } catch (error) {
        console.error("❌ Error in downloadYouTubeAudio:", error.message);
        throw error;
    }
};

// __________-------------Transcribe Audio using Puter.js (FREE)-------------__________
const transcribeAudioWithPuter = async (audioBuffer) => {
    try {
        console.log("📝 Transcribing audio using Puter.js (FREE)...");

        // Convert buffer to base64
        const base64Audio = audioBuffer.toString('base64');

        // Use Puter's free speech-to-text API
        const response = await axios.post(
            'https://api.puter.com/v1/ai/speech-to-text',
            {
                audio: base64Audio,
                language: 'en'
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60 seconds for transcription
            }
        );

        if (response.data && response.data.text) {
            console.log("✅ Transcription complete. Length:", response.data.text.length);
            return response.data.text;
        } else {
            throw new Error("Invalid response from Puter API");
        }

    } catch (error) {
        console.error("❌ Puter transcription error:", error.message);
        
        // Fallback: Return empty if Puter fails
        console.warn("⚠️ Puter.js transcription failed. Trying alternative approach...");
        throw new Error(`Transcription failed: ${error.message}`);
    }
};

// __________-------------Alternative: Transcribe using AssemblyAI (Limited Free Tier)-------------__________
const transcribeAudioWithAssemblyAI = async (audioBuffer) => {
    try {
        console.log("📝 Transcribing audio using AssemblyAI free tier...");

        // Note: AssemblyAI offers a limited free tier
        // Get API key from https://www.assemblyai.com/
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        
        if (!apiKey) {
            throw new Error("ASSEMBLYAI_API_KEY not set in environment");
        }

        // Upload audio first
        const uploadResponse = await axios.post(
            'https://api.assemblyai.com/v1/upload',
            audioBuffer,
            {
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/octet-stream'
                }
            }
        );

        const audioUrl = uploadResponse.data.upload_url;
        console.log("✅ Audio uploaded to AssemblyAI");

        // Request transcription
        const transcriptResponse = await axios.post(
            'https://api.assemblyai.com/v1/transcript',
            {
                audio_url: audioUrl,
                language_code: 'en'
            },
            {
                headers: {
                    'Authorization': apiKey
                }
            }
        );

        const transcriptId = transcriptResponse.data.id;

        // Poll for result (AssemblyAI processes asynchronously)
        let transcript = null;
        let attempts = 0;
        const maxAttempts = 30; // 30 * 2 seconds = 60 seconds timeout

        while (!transcript && attempts < maxAttempts) {
            const result = await axios.get(
                `https://api.assemblyai.com/v1/transcript/${transcriptId}`,
                {
                    headers: {
                        'Authorization': apiKey
                    }
                }
            );

            if (result.data.status === 'completed') {
                transcript = result.data.text;
                console.log("✅ Transcription complete. Length:", transcript.length);
                return transcript;
            } else if (result.data.status === 'error') {
                throw new Error(result.data.error);
            }

            // Wait 2 seconds before next attempt
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }

        if (!transcript) {
            throw new Error("Transcription timeout");
        }

    } catch (error) {
        console.error("❌ AssemblyAI transcription error:", error.message);
        throw error;
    }
};

// __________-------------Main: Download, Transcribe, Return Transcript-------------__________
const getYouTubeTranscript = async (videoUrl) => {
    try {
        // Step 1: Download audio
        const audioData = await downloadYouTubeAudio(videoUrl);

        // Step 2: Transcribe audio
        let transcript;
        
        try {
            // Try Puter first (completely FREE)
            transcript = await transcribeAudioWithPuter(audioData.buffer);
        } catch (puterError) {
            console.warn("⚠️ Puter failed, trying AssemblyAI...");
            try {
                // Fallback to AssemblyAI (limited free tier)
                transcript = await transcribeAudioWithAssemblyAI(audioData.buffer);
            } catch (assemblyError) {
                console.error("❌ Both transcription services failed");
                throw new Error("Failed to transcribe audio with any service");
            }
        }

        return {
            success: true,
            transcript: transcript,
            videoTitle: audioData.title,
            duration: audioData.duration
        };

    } catch (error) {
        console.error("❌ Error in getYouTubeTranscript:", error.message);
        throw error;
    }
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



module.exports = {
    downloadYouTubeAudio,
    transcribeAudioWithPuter,
    transcribeAudioWithAssemblyAI,
    getYouTubeTranscript,
    extractYouTubeTranscript,
    convertTranscriptToRecipe
};