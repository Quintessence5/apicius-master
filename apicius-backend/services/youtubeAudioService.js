const ytdl = require('ytdl-core');
const axios = require('axios');
const { Readable } = require('stream');
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

// ---------- Configuration des chemins pour les credentials YouTube (optionnel) ----------
const CREDENTIALS_PATH = path.join(__dirname, '../credentials/client_secret.json');
const TOKEN_PATH = path.join(__dirname, '../credentials/token.json');

// ---------- Conversion audio en MP3 (inchangée, déjà fonctionnelle) ----------
async function convertToMp3File(inputBuffer) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-'));
    const inputPath = path.join(tempDir, 'input.webm');
    const outputPath = path.join(tempDir, 'output.mp3');

    try {
        await fs.writeFile(inputPath, inputBuffer);
        await execPromise(
            `"${ffmpegStatic}" -y -f webm -i "${inputPath}" -vn -acodec libmp3lame -ab 192k "${outputPath}"`
        );
        const mp3Buffer = await fs.readFile(outputPath);
        if (!mp3Buffer || mp3Buffer.length < 1000) {
            throw new Error("MP3 conversion produced empty file");
        }
        console.log(`✅ MP3 conversion successful. Size: ${mp3Buffer.length} bytes`);
        return mp3Buffer;
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

// ---------- Téléchargement audio avec ytdl-core ----------
const downloadYouTubeAudio = async (videoUrl) => {
    try {
        console.log("🎬 Downloading audio with ytdl-core...");
        const info = await ytdl.getInfo(videoUrl);
        console.log(`✅ Video found: "${info.videoDetails.title}"`);

        const audioStream = ytdl(videoUrl, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        const chunks = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        console.log(`✅ Audio downloaded. Size: ${buffer.length} bytes`);
        return {
            buffer,
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds
        };
    } catch (error) {
        console.error("❌ ytdl-core error:", error.message);
        throw new Error(`Audio download failed: ${error.message}`);
    }
};

// ---------- Transcription avec AssemblyAI ----------
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

        // Demander la transcription
        console.log("📨 Requesting transcription...");
        const transcriptResponse = await axios.post(
            "https://api.assemblyai.com/v2/transcript",
            {
                audio_url: audioUrl,
                speech_models: ["universal"],
                language_code: "en"
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

        // Attendre le résultat
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

        // Dynamically import execa (ESM)
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
    
    // ---------- Step 2 : Secours audio ----------
    try {
        console.log("🎬 Downloading audio for transcription...");
        const audioData = await downloadYouTubeAudio(videoUrl); // votre fonction existante

        console.log("🎵 Converting audio to MP3...");
        const mp3Buffer = await convertToMp3File(audioData.buffer);

        const transcript = await transcribeAudioWithAssemblyAI(mp3Buffer);

        return {
            success: true,
            transcript,
            videoTitle: audioData.title,
            duration: audioData.duration,
            method: 'audio'
        };
    } catch (audioError) {
        console.error("❌ Error in audio transcription:", audioError.message);
        throw new Error("No transcript available from any source.");
    }
};

// ---------- Fonctions pour l'authentification YouTube (optionnelles) ----------
async function getYouTubeAuthClient() {
    const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf8'));
    const key = credentials.installed ? 'installed' : (credentials.web ? 'web' : null);
    if (!key) throw new Error('Invalid credentials file');

    const { client_secret, client_id, redirect_uris } = credentials[key];
    let redirectUri = 'http://localhost';
    if (redirect_uris && Array.isArray(redirect_uris) && redirect_uris.length > 0) {
        redirectUri = redirect_uris[0];
    }
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
    const token = JSON.parse(await fs.readFile(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    oAuth2Client.on('tokens', async (newToken) => {
        if (newToken.refresh_token) token.refresh_token = newToken.refresh_token;
        await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
        console.log('Token refreshed and saved.');
    });
    return oAuth2Client;
}

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
    transcribeAudioWithAssemblyAI,
    getYouTubeTranscript,
    extractYouTubeTranscript,
    convertTranscriptToRecipe
};