const pool = require('../config/db');
const { transcriptToRecipeService } = require('../services/transcriptService');
const { logConversion } = require('../services/conversionLogger');
const { getYouTubeTranscript } = require('../services/youtubeAudioService'); // 👈 ADD THIS

// Helper function to extract video ID from various YouTube URL formats
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

// __________-------------Extract YouTube Transcript (NEW METHOD)-------------__________
const extractYouTubeTranscript = async (req, res) => {
    try {
        const { videoUrl } = req.body;

        if (!videoUrl) {
            return res.status(400).json({ message: "Video URL is required" });
        }

        console.log("🎬 Starting YouTube audio extraction and transcription...");

        // Validate URL format
        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({ 
                message: "Invalid YouTube URL format. Supported:\n- https://www.youtube.com/watch?v=VIDEO_ID\n- https://youtu.be/VIDEO_ID\n- https://www.youtube.com/shorts/VIDEO_ID",
                receivedUrl: videoUrl
            });
        }

        console.log("✅ URL validated. Video ID:", videoId);

        try {
            // Download audio and transcribe using new service
            const result = await getYouTubeTranscript(videoUrl);

            console.log("✅ Transcript extracted successfully");

            // Log successful extraction
            await logConversion({
                source_type: 'youtube',
                source_url: videoUrl,
                transcript_text: result.transcript,
                status: 'transcript_extracted',
            });

            res.json({
                success: true,
                transcript: result.transcript,
                videoId: videoId,
                videoTitle: result.videoTitle,
                duration: result.duration,
                method: 'audio-download-and-transcribe',
                message: "✅ YouTube audio downloaded, transcribed, and ready for recipe conversion"
            });

        } catch (transcriptError) {
            console.error("❌ Error in audio extraction/transcription:", transcriptError.message);
            
            await logConversion({
                source_type: 'youtube',
                source_url: videoUrl,
                status: 'transcript_extraction_failed',
                error_message: transcriptError.message,
            });

            return res.status(400).json({
                message: "Could not extract and transcribe audio. Make sure the video is accessible and has audio content.",
                error: transcriptError.message,
                videoId: videoId,
                troubleshooting: [
                    "Ensure the YouTube URL is valid and public",
                    "Check that the video has audio content",
                    "Try a different video",
                    "Make sure your server can access YouTube"
                ]
            });
        }

    } catch (error) {
        console.error("❌ Critical error in extractYouTubeTranscript:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ... rest of the functions remain the same ...