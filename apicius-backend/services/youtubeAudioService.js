const ytdl = require('ytdl-core');
const axios = require('axios');
const { transcriptToRecipeService } = require('../services/transcriptService');
const { logConversion, logConversionError } = require('../services/conversionLogger');
const { extractVideoId } = require('../services/utils/videoUtils');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { google } = require('googleapis');

// ---------- Helper: parse duration from yt-dlp (e.g., "5:30" -> 330 seconds) ----------
const parseDuration = (durationStr) => {
    if (!durationStr) return null;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
        return parts[0];
    }
    return null;
};

// ---------- Configuration des chemins pour les credentials YouTube ----------
const CREDENTIALS_PATH = path.join(__dirname, '../credentials/client_secret.json');
const TOKEN_PATH = path.join(__dirname, '../credentials/token.json');

// ---------- Téléchargement audio avec yt-dlp (direct MP3) ----------
const downloadYouTubeAudioWithYtDlp = async (videoUrl) => {
    const { execa } = await import('execa');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-'));
    const outputPath = path.join(tempDir, 'audio.%(ext)s');

    try {
        // Download best audio and convert to mp3
        await execa('yt-dlp', [
            videoUrl,
            '--extract-audio',
            '--audio-format', 'mp3',
            '--output', outputPath,
            '--quiet',
            '--no-warnings'
        ]);

        // Find the generated mp3 file
        const files = await fs.readdir(tempDir);
        const mp3File = files.find(f => f.endsWith('.mp3'));
        if (!mp3File) throw new Error('No audio file generated');

        const filePath = path.join(tempDir, mp3File);
        const buffer = await fs.readFile(filePath);
        const { stdout: title } = await execa('yt-dlp', [
            '--get-title',
            videoUrl,
            '--quiet'
        ]);
        const { stdout: duration } = await execa('yt-dlp', [
            '--get-duration',
            videoUrl,
            '--quiet'
        ]);

        return {
            buffer,
            title: title.trim(),
            duration: parseDuration(duration.trim())
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
};

// ---------- Transcription avec AssemblyAI (auto‑detect language) ----------
const transcribeAudioWithAssemblyAI = async (audioBuffer) => {
    try {
        console.log("📝 Transcribing audio using AssemblyAI...");
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not set");

        if (!audioBuffer || audioBuffer.length < 1000) {
            throw new Error("Audio buffer is empty or invalid");
        }

        // Upload
        console.log("📤 Uploading audio to AssemblyAI...");
        const uploadResponse = await axios.post(
            "https://api.assemblyai.com/v2/upload",
            audioBuffer,
            {
                headers: {
                    Authorization: apiKey,
                    "Content-Type": "application/octet-stream"
                }
            }
        );
        const audioUrl = uploadResponse.data.upload_url;
        console.log("✅ Audio uploaded:", audioUrl);

        // Request transcription – let AssemblyAI auto‑detect language
        console.log("📨 Requesting transcription (language auto‑detection)...");
        const transcriptResponse = await axios.post(
            "https://api.assemblyai.com/v2/transcript",
            {
                audio_url: audioUrl,
                speech_models: ["universal"]
                // language_code omitted → auto‑detect
            },
            {
                headers: {
                    Authorization: apiKey,
                    "Content-Type": "application/json"
                }
            }
        );
        const transcriptId = transcriptResponse.data.id;
        console.log("🆔 Transcript ID:", transcriptId);

        // Poll for result
        let transcriptText = null;
        let attempts = 0;
        while (!transcriptText && attempts < 40) {
            await new Promise(r => setTimeout(r, 2000));
            const pollingResponse = await axios.get(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                { headers: { Authorization: apiKey } }
            );
            const status = pollingResponse.data.status;
            if (status === "completed") {
                transcriptText = pollingResponse.data.text;
                // Log detected language if available
                if (pollingResponse.data.language_code) {
                    console.log(`🌐 Detected language: ${pollingResponse.data.language_code}`);
                }
                break;
            } else if (status === "error") {
                throw new Error(pollingResponse.data.error);
            }
            attempts++;
            console.log(`⏳ Processing... (${attempts}/40)`);
        }

        if (!transcriptText) throw new Error("AssemblyAI transcription timeout");
        console.log("✅ AssemblyAI transcription complete");
        return transcriptText;
    } catch (error) {
        console.error("❌ AssemblyAI transcription error:", error.message);
        throw error;
    }
};

// ---------- Fonction principale : obtenir le transcript ----------
const getYouTubeTranscript = async (videoUrl) => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) throw new Error("Invalid YouTube URL");

    // ---------- Step 1: Try auto-generated subtitles with yt-dlp ----------
    try {
        console.log("🎬 Attempting to download auto-generated subtitles with yt-dlp...");

        const { execa } = await import('execa');

        const languages = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh-Hans'];
        let subtitleContent = null;

        for (const lang of languages) {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-sub-'));
            try {
                const outputTemplate = path.join(tempDir, '%(id)s.%(ext)s');

                await execa('yt-dlp', [
                    videoUrl,
                    '--skip-download',
                    '--write-auto-subs',
                    '--sub-lang', lang,
                    '--sub-format', 'srt',
                    '--output', outputTemplate,
                    '--quiet',
                    '--no-warnings'
                ], { reject: false });

                const files = await fs.readdir(tempDir);
                const subFile = files.find(f =>
                    f.includes(`.${lang}.`) && (f.endsWith('.srt') || f.endsWith('.vtt'))
                );

                if (subFile) {
                    const filePath = path.join(tempDir, subFile);
                    const rawContent = await fs.readFile(filePath, 'utf8');
                    console.log(`✅ Subtitles found (${lang})`);

                    subtitleContent = rawContent
                        .replace(/\d+\n\d{2}:\d{2}:\d{2},\d{3} --> .*?\n/g, '')
                        .replace(/<[^>]*>/g, '')
                        .replace(/\n{2,}/g, '\n')
                        .trim();

                    if (subtitleContent.length >= 20) break;
                }
            } catch (langError) {
                // Ignore, try next language
            } finally {
                await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
            }
        }

        if (!subtitleContent) {
            throw new Error("No subtitles available in any common language");
        }

        console.log(`✅ Subtitles downloaded. Length: ${subtitleContent.length} chars`);
        return {
            success: true,
            transcript: subtitleContent,
            videoTitle: null,
            duration: null,
            method: 'ytdlp'
        };
    } catch (subError) {
        console.error("❌ Subtitle download failed:", subError.message);
        console.log("⚠️ Falling back to audio transcription...");
    }

    // ---------- Step 2 : Try audio transcription with AssemblyAI ----------
    try {
        console.log("🎬 Attempting audio transcription with AssemblyAI...");
        const audioData = await downloadYouTubeAudioWithYtDlp(videoUrl);
        const transcript = await transcribeAudioWithAssemblyAI(audioData.buffer);
        return {
            success: true,
            transcript,
            videoTitle: audioData.title,
            duration: audioData.duration,
            method: 'assemblyai'
        };
    } catch (audioError) {
        console.error("❌ AssemblyAI transcription failed:", audioError.message);
        throw new Error("No transcript available from any source.");
    }
};

// __________-------------Extract YouTube Transcript (main endpoint)-------------__________
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

        console.log("🎬 Starting YouTube transcript extraction...");

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
            const result = await getYouTubeTranscript(videoUrl);

            console.log("✅ Transcript extracted successfully");

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
                videoId,
                videoTitle: result.videoTitle,
                duration: result.duration,
                method: result.method,   // 'ytdlp' or 'assemblyai'
                processingTime: Date.now() - startTime,
                message: "✅ Transcript extracted successfully"
            });

        } catch (transcriptError) {
            console.error("❌ Error in transcript extraction:", transcriptError.message);
            
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
                message: "Could not extract transcript",
                error: transcriptError.message,
                videoId,
                troubleshooting: [
                    "Ensure the YouTube URL is valid and public",
                    "Check that the video has audio content",
                    "Try a different video with better audio quality",
                    "Verify your AssemblyAI API key"
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

// __________-------------Convert Transcript to Recipe via Groq-------------__________
const convertTranscriptToRecipe = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { transcript, videoUrl, source, userId = null, videoTitle = null, videoDescription = null, channelName = null } = req.body;

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
            const { recipe: recipeData, processingTime, rawResponse } = await transcriptToRecipeService(
                transcript,
                { videoTitle, videoDescription, channelName }
            );

            if (!recipeData || !recipeData.title) {
                throw new Error("LLM failed to generate valid recipe data");
            }

            console.log("✅ Recipe generated successfully");

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
    downloadYouTubeAudioWithYtDlp,
    transcribeAudioWithAssemblyAI,
    getYouTubeTranscript,
    extractYouTubeTranscript,
    convertTranscriptToRecipe
};