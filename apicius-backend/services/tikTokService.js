const axios = require('axios');
const cheerio = require('cheerio');

// __________-------------Extract TikTok Video ID from various URL formats-------------__________
const extractTikTokVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    
    const patterns = [
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
        /(?:vt|vm|m)\.tiktok\.com\/(\w+)/i,
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

const isValidTikTokUrl = (url) => {
    return extractTikTokVideoId(url) !== null;
};

// __________-------------TikTok-Specific Ingredient Extraction-------------__________
/**
 * Extract ingredients from TikTok description format
 * TikTok descriptions use plain text format with quantities like:
 * "1 1/2 cups (180g) all-purpose flour"
 * "½ tsp salt"
 * "150g dark chocolate"
 */
const extractTikTokIngredients = (text) => {
    if (!text || text.length === 0) {
        console.log("⚠️ No text to extract ingredients from");
        return [];
    }

    console.log(`📝 Extracting ingredients from ${text.length} characters...`);
    const ingredients = [];
    const lines = text.split('\n');
    let currentSection = 'Main';
    let ingredientStarted = false;
    let ingredientEnded = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line || line.length === 0) continue;

        // Detect section headers (Ingredients, Chocolate Ganache, Instructions, etc.)
        if (/^(ingredients?|frosting|ganache|topping|filling|batter|dough|crust|sauce|glaze|base)$/i.test(line)) {
            currentSection = line.replace(/s?:?$/i, '').trim();
            ingredientStarted = true;
            continue;
        }

        // Stop ingredient extraction when we hit "Instructions"
        if (/^instructions?$/i.test(line)) {
            ingredientEnded = true;
            break;
        }

        // Skip metadata lines
        if (/^(serves?|servings?|yields?|makes?)[\s\d]*/i.test(line)) {
            continue;
        }

        // Look for ingredient pattern
        // Matches: "1 1/2 cups (180g) all-purpose flour"
        //          "1.5 tbsp salt"
        //          "150g dark chocolate"
        //          "2 large eggs"
        const ingredientPattern = /^([\d.]+(?:\s*\/\s*\d+)?(?:\s*-\s*[\d.]+)?)\s+([a-zA-Z\s\(\)]+?)(?:\s+(.+?))?(?:\s*\(([^)]*)\))?$/;
        
        const match = line.match(ingredientPattern);
        
        if (match) {
            let quantity = match[1].trim();
            let unit = match[2].trim();
            let name = match[3] ? match[3].trim() : '';
            let notes = match[4] ? `(${match[4]})` : '';

            // Normalize the unit and separate from name if mixed
            // Sometimes we get "1 1/2 cups all-purpose flour" where "cups" is in the unit field
            const unitMatch = unit.match(/^([a-zA-Z\s]+?)(?:\s+(.+))?$/);
            if (unitMatch) {
                unit = unitMatch[1].trim();
                if (unitMatch[2]) {
                    name = unitMatch[2].trim() + ' ' + name;
                }
            }

            // Clean up name
            name = name
                .replace(/\([^)]*\)/g, '')  // Remove parentheses content
                .replace(/\s+/g, ' ')       // Normalize spaces
                .trim();

            // Validate extracted data
            if (quantity && (unit || name)) {
                // Only keep if we have a reasonable ingredient name
                if (name.length > 1 && name.length < 100) {
                    ingredients.push({
                        quantity: quantity || null,
                        unit: unit || null,
                        name: name,
                        section: currentSection
                    });
                    console.log(`   ✅ Found: ${quantity} ${unit} ${name}`);
                }
            }
        } else if (ingredientStarted && !ingredientEnded) {
            // Try simpler pattern for lines without units
            // "2 large eggs" or "salt" (quantity without unit)
            const simplePattern = /^([\d.]+(?:\s*\/\s*\d+)?)\s+(.+)$/;
            const simpleMatch = line.match(simplePattern);
            
            if (simpleMatch) {
                const quantity = simpleMatch[1].trim();
                let name = simpleMatch[2].trim();
                
                name = name.replace(/\([^)]*\)/g, '').trim();
                
                if (name.length > 1 && name.length < 100) {
                    ingredients.push({
                        quantity: quantity,
                        unit: null,
                        name: name,
                        section: currentSection
                    });
                    console.log(`   ✅ Found: ${quantity} ${name}`);
                }
            }
        }
    }

    console.log(`✅ Total ingredients extracted: ${ingredients.length}`);
    return ingredients;
};

// __________-------------INTELLIGENT DESCRIPTION EXTRACTION FROM PAGE CONTEXT-------------__________
const extractDescriptionFromContext = (pageContent) => {
    console.log("🔍 Extracting description from page context...");
    
    if (!pageContent) return '';

    const $ = cheerio.load(pageContent);
    
    // Remove script and style tags
    $('script, style, noscript').remove();
    
    // Get all text
    let fullText = $.text();
    
    // Split into lines
    let lines = fullText.split(/\n|\r\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    console.log(`📊 Total lines found: ${lines.length}`);

    // Filter out common UI noise - but be LESS aggressive
    const uiNoisePatterns = [
        /^(copy|like|comment|share|follow|download|saved|add|favorite|report|block)$/i,
        /^comments?\s*\(\d+\)$/i,
        /^replies?\s*\(\d+\)$/i,
        /^shares?\s*\(\d+\)$/i,
        /^likes?\s*\(\d+\)$/i,
        /^\d{1,2}:\d{2}\/\d{1,2}:\d{2}$/,
        /^(more|less|show more|show less)$/i,
    ];

    const isUILabel = (line) => {
        // Only filter out SHORT lines that match UI patterns
        if (line.length > 50) return false; // Keep longer lines
        return uiNoisePatterns.some(pattern => pattern.test(line));
    };

    // Keep lines that look like content
    let contentLines = lines.filter(line => !isUILabel(line));
    
    console.log(`📊 Content lines after filtering: ${contentLines.length}`);

    if (contentLines.length === 0) {
        console.log("⚠️ No content lines found");
        return '';
    }

    // Join all content lines with newlines preserved
    let description = contentLines.join('\n');

    // Remove hashtags from end
    const hashtagMatch = description.match(/\s+(#\w+[\s\w]*)+$/);
    if (hashtagMatch) {
        description = description.replace(/\s+(#\w+[\s\w]*)+$/, '');
    }

    // Normalize multiple spaces but preserve newlines for ingredients
    description = description
        .replace(/[ \t]+/g, ' ')  // Multiple spaces to single space
        .trim();

    console.log(`✅ Description extracted: ${description.length} characters`);
    return description;
};

// __________-------------GET TIKTOK METADATA WITH IMPROVED EXTRACTION-------------__________
const getTikTokMetadata = async (videoUrl) => {
    let browser;
    try {
        console.log("📄 Fetching TikTok video metadata...");
        
        const videoId = extractTikTokVideoId(videoUrl);
        if (!videoId) {
            throw new Error("Invalid TikTok URL format");
        }

        const cleanUrl = videoUrl.split('?')[0];
        console.log(`🔗 Cleaned URL: ${cleanUrl}`);

        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 720 });

        console.log("🌐 Loading TikTok video page...");
        await page.goto(cleanUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get title
        const title = await page.evaluate(() => {
            const selectors = [
                'h1',
                '[data-e2e="video-title"]',
                'meta[property="og:title"]'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const content = element.getAttribute ? 
                        element.getAttribute('content') : 
                        element.textContent;
                    if (content && content.trim()) {
                        return content.trim();
                    }
                }
            }
            return null;
        });

        // Get creator
        const creatorMatch = cleanUrl.match(/@([\w.-]+)/);
        const creator = creatorMatch ? creatorMatch[1] : 'TikTok Creator';

        // Get page HTML
        const pageHTML = await page.content();

        // Extract description
        let description = extractDescriptionFromContext(pageHTML);

        // If still no description, try Puppeteer's direct text extraction
        if (!description || description.length < 50) {
            console.log("⚠️ Primary extraction gave limited results, trying comprehensive text extraction...");
            
            description = await page.evaluate(() => {
                return document.body.innerText || '';
            });
        }

        // Get thumbnail
        const thumbnail = await page.evaluate(() => {
            return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
        });

        await browser.close();

        console.log("✅ TikTok video page loaded");
        console.log(`✅ Title: "${title || 'TikTok Video'}"`);
        console.log(`✅ Creator: @${creator}`);
        console.log(`✅ Description length: ${description?.length || 0} characters`);
        console.log(`✅ Thumbnail: ${thumbnail ? '✓' : '✗'}`);

        return {
            title: title || 'TikTok Video Recipe',
            description: description || 'Cooking video from TikTok',
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

// __________-------------Other Functions-------------__________
const getTikTokThumbnail = (videoId, metadataThumbnail = null) => {
    try {
        if (metadataThumbnail) {
            return metadataThumbnail;
        }
        return `https://p16-sign.tiktokcdn.com/aweme/720x720/tos-maliva-avt-0068/${videoId}.jpeg`;
    } catch (error) {
        console.error("❌ Error getting TikTok thumbnail:", error);
        return null;
    }
};

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
    
    const ingredientUnits = /(cup|cups|tbsp|tsp|tablespoon|teaspoon|gram|grams|g|ml|milliliter|oz|pound|lb|pinch|dash)\b/gi;
    const unitMatches = (text.match(ingredientUnits) || []).length;
    const quantityMatches = (text.match(/\b\d+\.?\d*\s*(\/\s*\d+)?\b/g) || []).length;
    
    const hasIngredients = unitMatches >= 2 && quantityMatches >= 2;  // Lower threshold for TikTok
    
    const stepKeywords = /(step|instruction|direction|procedure|preheat|mix|whisk|combine|bake|cook|heat|cool|serve|spread|pour|add|place)\b/gi;
    const hasSteps = stepKeywords.test(text);

    return {
        hasIngredients,
        hasSteps,
        isEmpty: lines.length < 3,
        ingredientCount: unitMatches,
        lineCount: lines.length
    };
};

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
            error: "Invalid TikTok URL format"
        };
    }

    return {
        isValid: true,
        videoId: videoId
    };
};

module.exports = {
    extractTikTokVideoId,
    isValidTikTokUrl,
    getTikTokMetadata,
    getTikTokThumbnail,
    analyzeTikTokDescription,
    validateTikTokUrl,
    extractDescriptionFromContext,
    extractTikTokIngredients  // ✅ NEW: TikTok-specific extractor
};