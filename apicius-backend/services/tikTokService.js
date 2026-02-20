const axios = require('axios');
const cheerio = require('cheerio');

const pool = require('../config/db');

const { mergeIngredients } = require('../controllers/videoRecipeController');
const { logConversion, logConversionError } = require('../services/conversionLogger');
const {
    extractIngredientsFromText,
    generateRecipeWithLLM
} = require('../services/videoToRecipeService');

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
 * TikTok descriptions use plain text format with quantities*/
 
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
        const ingredientPattern = /^([\d.]+(?:\s*\/\s*\d+)?(?:\s*-\s*[\d.]+)?)\s+([a-zA-Z\s\(\)]+?)(?:\s+(.+?))?(?:\s*\(([^)]*)\))?$/;
        
        const match = line.match(ingredientPattern);
        
        if (match) {
            let quantity = match[1].trim();
            let unit = match[2].trim();
            let name = match[3] ? match[3].trim() : '';
            let notes = match[4] ? `(${match[4]})` : '';

            // Normalize the unit and separate from name if mixed
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

// __________-------------Extract Recipe from Creator's Website-------------__________
// __________-------------Extract Recipe from Creator's Website-------------__________
const extractRecipeFromCreatorWebsite = async (description, creatorName) => {
    try {
        console.log(`🔗 Attempting to extract website URL from description...`);
        
        // Extract URLs from description with better cleanup
        const urlPattern = /(https?:\/\/[^\s)]+)/g;
        let urls = description.match(urlPattern) || [];
        
        if (urls.length === 0) {
            console.log("⚠️ No URLs found in description");
            return null;
        }
        
        console.log(`🔗 Found ${urls.length} URL(s) in description`);
        
        // Clean up URLs - only keep the part before the first parenthesis
        urls = urls.map(url => {
            // Split on ( to remove anything in parentheses
            url = url.split('(')[0];
            
            // Remove trailing punctuation and whitespace
            url = url.replace(/[,;:)}\s]+$/, '');
            
            // Remove query parameters
            url = url.split('?')[0];
            
            // Remove fragments
            url = url.split('#')[0];
            
            // Ensure it ends with / if it's a path (not a file)
            if (!url.endsWith('/') && !url.match(/\.[a-z]{2,4}$/i)) {
                url = url + '/';
            }
            
            return url.trim();
        });
        
        // Remove duplicates
        urls = [...new Set(urls)];
        
        console.log(`📋 Cleaned URLs:`);
        urls.forEach((u, i) => console.log(`   ${i + 1}. ${u}`));
        
        // Filter out common non-recipe URLs and social media
        const recipeUrls = urls.filter(url => {
            const lowerUrl = url.toLowerCase();
            
            // Reject if it's just a domain (ends with .com/ or .com)
            if (/\.(com|org|net|co|io)(\/)?$/.test(lowerUrl)) {
                console.log(`   ❌ Rejected (domain only): ${url}`);
                return false;
            }
            
            // Reject social media and external sites
            if (lowerUrl.includes('tiktok.com') ||
                lowerUrl.includes('instagram.com') ||
                lowerUrl.includes('youtube.com') ||
                lowerUrl.includes('facebook.com') ||
                lowerUrl.includes('twitter.com') ||
                lowerUrl.includes('pinterest.com')) {
                console.log(`   ❌ Rejected (social media): ${url}`);
                return false;
            }
            
            // Reject navigation/utility pages
            if (lowerUrl.includes('/contact') ||
                lowerUrl.includes('/about') ||
                lowerUrl.includes('/shop') ||
                lowerUrl.includes('/category') ||
                lowerUrl.includes('/page/') ||
                lowerUrl.includes('/author/') ||
                lowerUrl.includes('/tag/') ||
                lowerUrl.includes('/search')) {
                console.log(`   ❌ Rejected (navigation page): ${url}`);
                return false;
            }
            
            console.log(`   ✅ Accepted: ${url}`);
            return true;
        });
        
        if (recipeUrls.length === 0) {
            console.log("⚠️ No valid recipe URLs found");
            return null;
        }
        
        console.log(`\n🔗 Found ${recipeUrls.length} valid recipe URL(s)`);
        
        // Score URLs based on relevance
        const scoredUrls = recipeUrls.map(url => {
            let score = 0;
            const lowerUrl = url.toLowerCase();
            const lowerCreator = creatorName.toLowerCase();
            
            // Check if URL contains creator name or domain
            if (lowerUrl.includes(lowerCreator)) score += 10;
            if (lowerUrl.includes('recipe')) score += 8;
            if (lowerUrl.includes('food') || lowerUrl.includes('cook')) score += 5;
            if (lowerUrl.includes('cake') || lowerUrl.includes('dessert') || lowerUrl.includes('chocolate')) score += 4;
            
            // Prefer recipe-like paths (not too many slashes)
            const slashCount = (url.match(/\//g) || []).length;
            if (slashCount <= 4) score += 3;
            
            // Penalize very long URLs
            if (url.length > 100) score -= 2;
            
            console.log(`   📊 Score: ${score.toString().padStart(2, ' ')} → ${url}`);
            
            return { url, score };
        });
        
        // Sort by score descending
        scoredUrls.sort((a, b) => b.score - a.score);
        
        const targetUrl = scoredUrls[0].url;
        console.log(`\n🎯 Selected best URL: ${targetUrl}`);
        
        const puppeteer = require('puppeteer');
        let browser;
        
        try {
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
            
            console.log(`🌐 Navigating to: ${targetUrl}`);
            
            await page.goto(targetUrl, {
                waitUntil: 'networkidle2',
                timeout: 15000
            });
            
            const finalUrl = page.url();
            console.log(`✅ Page loaded from: ${finalUrl}`);
            
            // Check if final URL is acceptable
            const lowerFinalUrl = finalUrl.toLowerCase();
            if (/\.(com|org|net|co|io)(\/)?$/.test(lowerFinalUrl)) {
                console.log(`⚠️ Final URL is domain-only, skipping`);
                await browser.close();
                return null;
            }
            
            if (lowerFinalUrl.includes('tiktok.com') || 
                lowerFinalUrl.includes('instagram.com') ||
                lowerFinalUrl.includes('facebook.com')) {
                console.log(`⚠️ Final URL redirected to social media, skipping`);
                await browser.close();
                return null;
            }
            
            // Wait for content to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Extract recipe content - FOCUS ONLY ON INGREDIENTS AND INSTRUCTIONS
            const extractedData = await page.evaluate(() => {
                let recipeHTML = '';
                
                // First, try to extract from recipe plugin structure
                const ingredientsSection = document.querySelector('.tasty-recipes-ingredients');
                const instructionsSection = document.querySelector('.tasty-recipes-instructions');
                
                if (ingredientsSection) {
                    // Extract ingredients from list items
                    const ingredientsList = ingredientsSection.querySelectorAll('li');
                    if (ingredientsList.length > 0) {
                        recipeHTML += 'INGREDIENTS\n';
                        
                        ingredientsList.forEach(li => {
                            // Get the text content of the <li>
                            let ingredientText = li.innerText || li.textContent;
                            
                            // Extract quantities and units from data attributes if available
                            const quantitySpan = li.querySelector('[data-amount]');
                            const unitSpan = li.querySelector('[data-unit]');
                            
                            if (quantitySpan && unitSpan) {
                                const amount = quantitySpan.getAttribute('data-amount');
                                const unit = quantitySpan.getAttribute('data-unit');
                                const name = ingredientText.replace(/[\d\s\/½¼⅓⅔]+/g, '').trim();
                                recipeHTML += `${amount} ${unit} ${name}\n`;
                            } else {
                                // Fallback: clean up the text
                                ingredientText = ingredientText
                                    .replace(/^[\s\n]+/, '') // Remove leading whitespace
                                    .replace(/\s*\n\s*/g, ' ') // Convert newlines to spaces
                                    .trim();
                                recipeHTML += ingredientText + '\n';
                            }
                        });
                    }
                }
                
                // Now get instructions
                if (instructionsSection) {
                    recipeHTML += '\nINSTRUCTIONS\n';
                    const instructionsList = instructionsSection.querySelectorAll('li, p');
                    instructionsList.forEach(el => {
                        let stepText = el.innerText || el.textContent;
                        stepText = stepText.trim();
                        if (stepText.length > 0) {
                            recipeHTML += stepText + '\n';
                        }
                    });
                } else {
                    // If no dedicated instructions section, get the main article
                    const articleContent = document.querySelector('article') || document.querySelector('main');
                    if (articleContent) {
                        recipeHTML += '\n' + (articleContent.innerText || articleContent.textContent);
                    }
                }
                
                return recipeHTML;
            });
            
            await browser.close();
            
            if (!extractedData || extractedData.trim().length < 100) {
                console.log("⚠️ Fetched content is too short or empty");
                return null;
            }
            
            console.log(`✅ Successfully extracted recipe content (${extractedData.length} characters)`);
            return extractedData;
            
        } catch (fetchError) {
            if (browser) {
                await browser.close().catch(() => {});
            }
            console.log(`⚠️ Failed to fetch website content: ${fetchError.message}`);
            return null;
        }
        
    } catch (error) {
        console.error(`❌ Error extracting recipe from creator website:`, error.message);
        return null;
    }
};

// __________-------------Main Endpoint: Extract Recipe from TikTok Video-------------__________
const extractRecipeFromTikTok = async (req, res) => {
    const startTime = Date.now();
    let conversionId = null;

    try {
        const { videoUrl, userId = null } = req.body;
        if (!videoUrl) {
            return res.status(400).json({ success: false, message: "Video URL is required" });
        }

        console.log("\n🎬 ========== STARTING TIKTOK RECIPE EXTRACTION ==========");
        console.log(`Source: ${videoUrl}`);
        console.log("📼 Step 0: Checking for existing recipe...");
        
        // Check if this URL has been processed before
        const existingRecipeCheck = await pool.query(
            `SELECT r.id as recipe_id, r.title, tc.id as conversion_id
             FROM transcript_conversions tc
             LEFT JOIN recipes r ON tc.recipe_json->>'title' = r.title
             WHERE tc.source_url = $1 AND tc.status = 'recipe_generated'
             ORDER BY tc.created_at DESC LIMIT 1`,
            [videoUrl]
        );

        if (existingRecipeCheck.rows.length > 0 && existingRecipeCheck.rows[0].recipe_id) {
            console.log(`✅ Found existing recipe! ID: ${existingRecipeCheck.rows[0].recipe_id}`);
            
            return res.json({
                success: true,
                redirect: true,
                recipeId: existingRecipeCheck.rows[0].recipe_id,
                message: "Recipe already exists for this URL",
                processingTime: Date.now() - startTime
            });
        }

        // Step 1: Validate TikTok URL
        console.log("📼 Step 1: Validating TikTok URL...");
        const urlValidation = validateTikTokUrl(videoUrl);
        
        if (!urlValidation.isValid) {
            console.log(`❌ Invalid TikTok URL: ${urlValidation.error}`);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'tiktok',
                source_url: videoUrl,
                status: 'url_validation_failed',
                error_message: urlValidation.error,
                processing_time_ms: Date.now() - startTime
            });

            return res.status(400).json({
                success: false,
                conversionId,
                message: "Invalid TikTok URL format",
                error: urlValidation.error,
                supportedFormats: [
                    'https://www.tiktok.com/@username/video/VIDEO_ID',
                    'https://vt.tiktok.com/shortcode',
                    'https://m.tiktok.com/@username/video/VIDEO_ID'
                ]
            });
        }

        const videoId = urlValidation.videoId;
        console.log(`✅ Valid TikTok URL. Video ID: ${videoId}`);

        // Step 2: Fetch TikTok metadata
        console.log("\n📼 Step 2: Fetching TikTok metadata...");
        let tikTokMetadata;
        let videoThumbnail = null;
        
        try {
            tikTokMetadata = await getTikTokMetadata(videoUrl);
            videoThumbnail = getTikTokThumbnail(videoId, tikTokMetadata.thumbnail);
            console.log(`✅ Title: "${tikTokMetadata.title}"`);
            console.log(`✅ Creator: @${tikTokMetadata.creator}`);
            console.log(`✅ Description length: ${tikTokMetadata.description?.length || 0} characters`);
            console.log(`✅ Thumbnail: ${videoThumbnail ? '✓' : '✗'}`);
        } catch (metadataError) {
            console.warn(`⚠️ TikTok metadata fetch failed: ${metadataError.message}`);
            console.log("⚠️ User will be prompted to manually enter transcript");
            
            // Log but don't fail - allow fallback to manual input
            await logConversion({
                user_id: userId,
                source_type: 'tiktok',
                source_url: videoUrl,
                status: 'metadata_fetch_failed',
                error_message: metadataError.message,
                processing_time_ms: Date.now() - startTime
            });

            return res.status(400).json({
                success: false,
                requiresManualInput: true,
                message: "Could not automatically fetch TikTok video data",
                error: metadataError.message,
                suggestion: "Please paste the video description or transcript manually below",
                supportedFormats: [
                    'https://www.tiktok.com/@username/video/VIDEO_ID',
                    'https://vt.tiktok.com/shortcode'
                ]
            });
        }

        // Step 3: Analyze description
        console.log("\n📼 Step 3: Analyzing description content...");
        const analysis = analyzeTikTokDescription(tikTokMetadata.description);
        console.log(`   - Has ingredients: ${analysis.hasIngredients}`);
        console.log(`   - Has steps: ${analysis.hasSteps}`);
        console.log(`   - Total lines: ${analysis.lineCount}`);

        // Step 4: Extract ingredients
        console.log("\n📼 Step 4: Extracting ingredients from description...");
        let extractedIngredients;
        
        // Use TikTok-specific ingredient extractor
        const { extractTikTokIngredients } = require('../services/tikTokService');
        extractedIngredients = extractTikTokIngredients(tikTokMetadata.description);
        
        console.log(`✅ Extracted ${extractedIngredients.length} ingredients from description`);
         // Step 5: Try to find recipe on creator's website if description is sparse
        console.log("\n📼 Step 5: Checking for recipe on creator's website...");
        let websiteRecipeContent = "";
        
        // Only try to find website recipe if we have very few ingredients
        if (extractedIngredients.length < 3) {
            console.log("⚠️ Sparse ingredients detected, searching for creator's website...");
            
            try {
                const { extractRecipeFromCreatorWebsite } = require('../services/tikTokService');
                const websiteContent = await extractRecipeFromCreatorWebsite(
                    tikTokMetadata.description,
                    tikTokMetadata.creator
                );
                
                if (websiteContent) {
                    console.log(`✅ Found recipe content on creator website`);
                    websiteRecipeContent = websiteContent;
                    
                    // Try to extract ingredients from website content
                    const websiteIngredients = extractIngredientsFromText(websiteContent);
                    if (websiteIngredients.length > 0) {
                        console.log(`✅ Extracted ${websiteIngredients.length} additional ingredients from website`);
                        extractedIngredients = mergeIngredients(extractedIngredients, websiteIngredients);
                    }
                } else {
                    console.log("⚠️ No recipe found on creator website, continuing with description only");
                }
            } catch (websiteError) {
                console.warn(`⚠️ Website scraping failed (continuing): ${websiteError.message}`);
            }
        } else {
            console.log("✅ Sufficient ingredients found, skipping website search");
        }

                // Step 6: Generate recipe with LLM
        console.log("\n📼 Step 6: Generating recipe with Groq LLM...");
        let finalRecipe;
        try {
            const response = await generateRecipeWithLLM(
                tikTokMetadata.description,
                tikTokMetadata.title,
                tikTokMetadata.creator,
                extractedIngredients
            );
            
            // ✅ FIX: Handle response properly
            finalRecipe = response.recipe || response;
            
            if (!finalRecipe || !finalRecipe.title) {
                throw new Error("Invalid recipe data received from LLM");
            }
            
            console.log(`✅ Recipe generated successfully`);
            console.log(`   - Ingredients: ${finalRecipe.ingredients.length}`);
            console.log(`   - Steps: ${finalRecipe.steps.length}`);
        } catch (groqError) {
            console.error("\n❌ LLM Error:", groqError.message);
            
            conversionId = await logConversion({
                user_id: userId,
                source_type: 'tiktok',
                source_url: videoUrl,
                video_title: tikTokMetadata.title,
                transcript_text: tikTokMetadata.description,
                status: 'recipe_generation_failed',
                error_message: groqError.message,
                processing_time_ms: Date.now() - startTime
            });

            if (conversionId) {
                await logConversionError(conversionId, 'GroqError', groqError.message, 'recipe_generation');
            }

            return res.status(500).json({
                success: false,
                conversionId,
                message: "Failed to generate recipe from TikTok video",
                error: groqError.message
            });
        }

        // Step 7: Match ingredients with database
        console.log("\n📼 Step 7: Matching ingredients with database...");
        let ingredientMatches;
        try {
            ingredientMatches = await matchIngredientsWithDatabase(finalRecipe.ingredients);
        } catch (matchError) {
            console.warn("⚠️ Ingredient matching error (continuing anyway):", matchError.message);
            ingredientMatches = {
                all: finalRecipe.ingredients.map(ing => ({
                    ...ing,
                    dbId: null,
                    found: false,
                    icon: '⚠️'
                })),
                matched: [],
                unmatched: finalRecipe.ingredients,
                matchPercentage: 0
            };
        }

        // Step 8: Log conversion
        console.log("\n📼 Step 8: Logging conversion to database...");
        conversionId = await logConversion({
            user_id: userId,
            source_type: 'tiktok',
            source_url: videoUrl,
            video_title: tikTokMetadata.title,
            transcript_text: tikTokMetadata.description,
            recipe_json: finalRecipe,
            recipe_status: 'generated',
            status: 'recipe_generated',
            processing_time_ms: Date.now() - startTime
        });

        console.log(`✅ Conversion logged with ID: ${conversionId}`);
        console.log("\n🎬 ========== TIKTOK EXTRACTION COMPLETE ==========\n");

        res.json({
            success: true,
            conversionId,
            recipe: finalRecipe,
            ingredientMatches: ingredientMatches,
            videoTitle: tikTokMetadata.title,
            creator: tikTokMetadata.creator,
            videoThumbnail: videoThumbnail,
            processingTime: Date.now() - startTime,
            message: "✅ Recipe extracted from TikTok successfully!"
        });

    } catch (error) {
        console.error("\n❌ CRITICAL ERROR:", error.message);
        
        if (conversionId) {
            await logConversionError(conversionId, 'CriticalError', error.message, 'extraction');
        }

        res.status(500).json({
            success: false,
            conversionId,
            message: "Server error during TikTok recipe extraction",
            error: error.message
        });
    }
};

module.exports = {
    extractTikTokVideoId,
    isValidTikTokUrl,
    getTikTokMetadata,
    getTikTokThumbnail,
    analyzeTikTokDescription,
    validateTikTokUrl,
    extractDescriptionFromContext,
    extractTikTokIngredients,
    extractRecipeFromTikTok,
    extractRecipeFromCreatorWebsite
};