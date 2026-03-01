async function getVideoDuration(url) {
    try {
        // Dynamically import execa (ESM)
        const { execa } = await import('execa');
        const { stdout } = await execa('yt-dlp', ['--get-duration', url, '--quiet']);
        const durationStr = stdout.trim();
        // Parse duration like "HH:MM:SS", "MM:SS", or "SS"
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 1) {
            return parts[0];
        }
        return null;
    } catch (error) {
        console.error('Error getting video duration:', error.message);
        return null;
    }
}

module.exports = { getVideoDuration };