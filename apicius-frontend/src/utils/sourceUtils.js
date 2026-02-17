export const getSourceInfo = (sourceUrl) => {
    if (!sourceUrl) return null;

    try {
        const url = new URL(sourceUrl);
        const hostname = url.hostname.replace('www.', '');
        
        const sourceMap = {
            'youtube.com': { name: 'YouTube', icon: '▶️', color: '#FF0000' },
            'youtu.be': { name: 'YouTube', icon: '▶️', color: '#FF0000' },
            'tiktok.com': { name: 'TikTok', icon: '🎵', color: '#000000' },
            'instagram.com': { name: 'Instagram', icon: '📷', color: '#E1306C' },
            'facebook.com': { name: 'Facebook', icon: '👍', color: '#1877F2' },
            'pinterest.com': { name: 'Pinterest', icon: '📌', color: '#E60023' },
            'twitch.tv': { name: 'Twitch', icon: '🎮', color: '#9146FF' },
            'twitter.com': { name: 'Twitter', icon: '𝕏', color: '#000000' },
            'reddit.com': { name: 'Reddit', icon: '🔴', color: '#FF4500' },
            'vimeo.com': { name: 'Vimeo', icon: '▶️', color: '#1AB7EA' },
        };

        // Find matching source
        for (const [domain, info] of Object.entries(sourceMap)) {
            if (hostname.includes(domain)) {
                return {
                    ...info,
                    url: sourceUrl
                };
            }
        }

        // Default for unknown sources
        return {
            name: hostname.charAt(0).toUpperCase() + hostname.slice(1),
            icon: '🔗',
            color: '#666',
            url: sourceUrl
        };
    } catch (error) {
        console.error('Error parsing source URL:', error);
        return null;
    }
};