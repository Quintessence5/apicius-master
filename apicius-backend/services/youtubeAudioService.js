const ytdl = require('ytdl-core');
const axios = require('axios');
const { Readable } = require('stream');

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

module.exports = {
    downloadYouTubeAudio,
    transcribeAudioWithPuter,
    transcribeAudioWithAssemblyAI,
    getYouTubeTranscript
};