const axios = require('axios');
const cheerio = require('cheerio');

// __________-------------Extract TikTok Video ID from various URL formats-------------__________
/**
 * Extract TikTok video ID from various URL formats
 * @param {string} url - TikTok URL
 * @returns {string|null} Video ID or null if invalid
 * 
 * Supports:
 * - https://www.tiktok.com/@username/video/VIDEO_ID
 * - https://vt.tiktok.com/SHORTCODE
 * - https://m.tiktok.com/@username/video/VIDEO_ID
 * - https://tiktok.com/@username/video/VIDEO_ID
 */
const extractTikTokVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    
    const patterns = [
        // Long format: https://www.tiktok.com/@username/video/123456789
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
        // Short format: https://vt.tiktok.com/SHORTCODE or https://m.tiktok.com/@username/video/ID
        /(?:vt|vm|m)\.tiktok\.com\/(\w+)/i,
        // Mobile format
        /m\.tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
};

/**
 * Validate if a URL is a valid TikTok URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid TikTok URL
 */
const isValidTikTokUrl = (url) => {
    return extractTikTokVideoId(url) !== null;
};

// __________-------------Get TikTok Video Metadata via HTML Scraping-------------__________
/**
 * @param {string} videoUrl - TikTok video URL
 * @returns {Promise<Object>} Metadata object {title, description, creator, creatorAvatar, thumbnail, videoId}
 */
const getTikTokMetadata = async (videoUrl) => {
    let browser;
    try {
        console.log("📄 Fetching TikTok video metadata...");
        
        const videoId = extractTikTokVideoId(videoUrl);
        if (!videoId) {
            throw new Error("Invalid TikTok URL format");
        }

        // Use Puppeteer to render JavaScript-heavy TikTok page
        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();
        
        // Set user agent and viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setViewport({ width: 1280, height: 720 });

        console.log("🌐 Loading TikTok page with Puppeteer...");
        await page.goto(videoUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for description element to appear
        await page.waitForSelector('[data-e2e="browse-video-desc"]', {
            timeout: 5000
        }).catch(() => {
            console.warn("⚠️ Description container not found");
        });

        // Extract all description text from spans
        const descriptionText = await page.evaluate(() => {
            const descDiv = document.querySelector('[data-e2e="browse-video-desc"]');
            if (!descDiv) return null;

            const spans = descDiv.querySelectorAll('span[data-e2e="new-desc-span"]');
            const texts = Array.from(spans)
                .map(span => span.textContent.trim())
                .filter(text => text.length > 0 && !text.startsWith('#'));

            return texts.join('\n');
        });

        // Extract title
        const title = await page.evaluate(() => {
            // TikTok title is usually in meta tag or h1
            const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
            if (metaTitle) return metaTitle;
            
            const h1 = document.querySelector('h1');
            if (h1) return h1.textContent;
            
            return null;
        });

        // Extract creator from URL
        const creatorMatch = videoUrl.match(/@([\w.-]+)/);
        const creator = creatorMatch ? creatorMatch[1] : 'TikTok Creator';

        // Extract thumbnail
        const thumbnail = await page.evaluate(() => {
            return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
        });

        await browser.close();

        console.log("✅ TikTok page loaded and parsed with Puppeteer");
        console.log(`✅ Title: "${title || 'TikTok Video Recipe'}"`);
        console.log(`✅ Creator: @${creator}`);
        console.log(`✅ Description length: ${descriptionText?.length || 0} characters`);
        console.log(`✅ Thumbnail: ${thumbnail ? '✓' : '✗'}`);

        return {
            title: title || 'TikTok Video Recipe',
            description: descriptionText || 'Cooking video from TikTok',
            creator: creator,
            creatorAvatar: null,
            thumbnail: thumbnail,
            videoId: videoId,
            originalUrl: videoUrl
        };

    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }
        console.error("❌ Error fetching TikTok metadata:", error.message);
        throw new Error(`Could not fetch TikTok video metadata: ${error.message}`);
    }
};

/**
 * Extract URLs from text and try to fetch recipe data from creator website
 * 
 * @param {string} description - Description text
 * @param {string} creator - Creator name
 * @returns {Promise<string|null>} Recipe content from website or null if not found
 */
const extractRecipeFromCreatorWebsite = async (description, creator) => {
    try {
        console.log("\n🔗 Attempting to find recipe on creator's website...");
        
        if (!description || description.trim() === 'Cooking video from TikTok') {
            console.warn("⚠️ No description to search for URLs");
            return null;
        }

        // Extract URLs from description
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urlMatches = description.match(urlRegex);

        if (!urlMatches || urlMatches.length === 0) {
            console.warn("⚠️ No URLs found in description");
            return null;
        }

        console.log(`Found ${urlMatches.length} URL(s) in description`);

        // Try each URL
        for (const url of urlMatches) {
            try {
                const cleanUrl = url.replace(/[,.\]}\)]+$/, ''); // Remove trailing punctuation
                console.log(`🔍 Checking URL: ${cleanUrl}`);

                const response = await axios.get(cleanUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 10000,
                    maxRedirects: 3
                });

                const $ = cheerio.load(response.data);

                // Look for recipe-like content
                let recipeContent = null;

                // Method 1: Look for recipe class/id
                let recipeSection = $('[class*="recipe"]').first().text();
                if (!recipeSection) {
                    recipeSection = $('[id*="recipe"]').first().text();
                }
                if (!recipeSection) {
                    // Method 2: Look for ingredients list
                    recipeSection = $('ul').first().text();
                }
                if (recipeSection && recipeSection.length > 50) {
                    recipeContent = recipeSection;
                }

                if (recipeContent) {
                    console.log(`✅ Found recipe content on ${cleanUrl}`);
                    console.log(`📄 Content preview: ${recipeContent.substring(0, 100)}...`);
                    return recipeContent;
                }

            } catch (urlError) {
                console.warn(`⚠️ Could not access ${url}: ${urlError.message}`);
                continue;
            }
        }

        console.warn("⚠️ No recipe content found on creator websites");
        return null;

    } catch (error) {
        console.error("❌ Error extracting recipe from creator website:", error.message);
        return null;
    }
};

// __________-------------Get TikTok Video Thumbnail with fallback-------------__________
/**
 * Get TikTok thumbnail URL or construct fallback
 * @param {string} videoId - TikTok video ID
 * @param {string} metadataThumbnail - Thumbnail from metadata (if available)
 * @returns {string|null} Thumbnail URL
 */
const getTikTokThumbnail = (videoId, metadataThumbnail = null) => {
    try {
        // If we have metadata thumbnail, use it
        if (metadataThumbnail) {
            return metadataThumbnail;
        }

        // Construct TikTok thumbnail URL
        // TikTok uses a specific URL pattern for thumbnails
        const thumbnailUrl = `https://p16-sign.tiktokcdn.com/aweme/720x720/tos-maliva-avt-0068/${videoId}.jpeg?x-expires=1234567890`;
        return thumbnailUrl;

    } catch (error) {
        console.error("❌ Error getting TikTok thumbnail:", error);
        return null;
    }
};

// __________-------------Analyze TikTok description content-------------__________
/**
 * Analyze if description contains ingredients/steps
 * @param {string} text - Description text
 * @returns {Object} Analysis result {hasIngredients, hasSteps, isEmpty, ingredientCount, lineCount}
 */
const analyzeTikTokDescription = (text) => {
    if (!text || text.trim().length === 0) {
        return {
            hasIngredients: false,
            hasSteps: false,
            isEmpty: true,
            ingredientCount: 0,
            lineCount: 0
        };
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Check for ingredient-like content
    const ingredientUnits = /(cup|cups|tbsp|tsp|tablespoon|teaspoon|gram|grams|g|ml|milliliter|oz|pound|lb|pinch|dash)\b/gi;
    const unitMatches = (text.match(ingredientUnits) || []).length;
    const quantityMatches = (text.match(/\b\d+\.?\d*\s*(\/\s*\d+)?\b/g) || []).length;
    
    const hasIngredients = unitMatches >= 2 && quantityMatches >= 3;
    
    // Check for steps/instructions
    const stepKeywords = /(step|instruction|direction|procedure|preheat|mix|whisk|combine|bake|cook|heat|cool|serve|spread|pour|add|place)/gi;
    const hasSteps = stepKeywords.test(text);

    return {
        hasIngredients,
        hasSteps,
        isEmpty: lines.length < 2,
        ingredientCount: unitMatches,
        lineCount: lines.length
    };
};

// __________-------------Validate TikTok URL format-------------__________
/**
 * Enhanced URL validation with error details
 * @param {string} url - URL to validate
 * @returns {Object} {isValid: boolean, error?: string, videoId?: string}
 */
const validateTikTokUrl = (url) => {
    if (!url || typeof url !== 'string') {
        return {
            isValid: false,
            error: "URL is required and must be a string"
        };
    }

    const videoId = extractTikTokVideoId(url);
    
    if (!videoId) {
        return {
            isValid: false,
            error: "Invalid TikTok URL format. Supported formats: https://www.tiktok.com/@username/video/ID or https://vt.tiktok.com/shortcode"
        };
    }

    return {
        isValid: true,
        videoId: videoId
    };
};

/**
 * Extracts metadata from TikTok video URL.
 * 
 * @param {string} url - The TikTok video URL.
 * @returns {Promise<Object>} - A promise that resolves to the video metadata.
 */
async function extractTikTokMetadata(url) {
    // Validate the TikTok URL
    if (!isValidTikTokURL(url)) {
        throw new Error('Invalid TikTok URL');
    }

    // Logic to fetch TikTok metadata goes here (e.g., using an HTTP request)
    // For demonstration purposes, we'll return a mock object
    const mockMetadata = {
        id: '123456',
        title: 'Sample TikTok Video',
        description: 'This is a sample TikTok video description.',
        creator: 'TikTokUser',
        likes: 1500,
        shares: 300,
        comments: 50,
    };

    return mockMetadata;
}

/**
 * Validates the TikTok video URL.
 * 
 * @param {string} url - The TikTok video URL.
 * @returns {boolean} - True if the URL is valid, false otherwise.
 */
function isValidTikTokURL(url) {
    const tikTokURLPattern = /https?:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9]+\/video\/[0-9]+/;
    return tikTokURLPattern.test(url);
}

module.exports = {
    extractTikTokVideoId,
    extractTikTokMetadata,
    isValidTikTokUrl,
    getTikTokMetadata,
    getTikTokThumbnail,
    analyzeTikTokDescription,
    validateTikTokUrl,
    extractRecipeFromCreatorWebsite
};
