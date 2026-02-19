/**
//Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null if invalid
 * 
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */

const extractVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    
    // YouTube patterns
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
        /youtu\.be\/([^&\n?#]+)/,
    ];

    for (const pattern of youtubePatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    // TikTok patterns
    const tiktokPatterns = [
        // Long format: https://www.tiktok.com/@username/video/123456789
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
        // Short format: https://vt.tiktok.com/SHORTCODE or https://m.tiktok.com/@username/video/ID
        /(?:vt|vm|m)\.tiktok\.com\/(\w+)/i,
        // Mobile format
        /m\.tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
    ];

    for (const pattern of tiktokPatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};

const detectPlatform = (url) => {
    if (!url || typeof url !== 'string') return null;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return 'youtube';
    }
    
    if (url.includes('tiktok.com') || url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com')) {
        return 'tiktok';
    }

    return null;
};

/**
 * Validate if a URL is a valid YouTube URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid YouTube URL
 */
const isValidYouTubeUrl = (url) => {
    return extractVideoId(url) !== null;
};

const isValidTikTokUrl = (url) => {
    return url && (url.includes('tiktok.com') || url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com')) && extractVideoId(url) !== null;
};

module.exports = {
    extractVideoId,
    detectPlatform,
    isValidYouTubeUrl,
    isValidTikTokUrl
};