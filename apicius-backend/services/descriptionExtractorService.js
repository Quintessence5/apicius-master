const axios = require('axios');

// __________-------------Fetch YouTube video metadata using Cheerio (HTML scraping)-------------__________
const getYouTubeDescriptionByScrapy = async (videoUrl) => {
    try {
        console.log("📄 Fetching YouTube video description via direct request...");
        
        // Extract video ID
        const videoIdMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
        if (!videoIdMatch) {
            throw new Error("Invalid YouTube URL");
        }
        
        const videoId = videoIdMatch[1];
        
        // Try fetching the raw HTML which contains metadata in JSON
        const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const html = response.data;
        
        // Extract initial data from HTML using regex
        const initialDataMatch = html.match(/var ytInitialData = ({.*?});/);
        if (!initialDataMatch) {
            throw new Error("Could not extract initial data from YouTube page");
        }
        
        const initialDataStr = initialDataMatch[1];
        const initialData = JSON.parse(initialDataStr);
        
        // Navigate through the data structure to find title and description
        let title = null;
        let description = null;
        
        try {
            // Try to find title
            const titleObj = initialData?.metadata?.videoMetadata?.title;
            title = titleObj || null;
        } catch (e) {
            console.warn("Could not extract title from initial data");
        }
        
        try {
            // Try to find description
            const descriptionObj = initialData?.metadata?.videoMetadata?.description;
            description = descriptionObj || null;
        } catch (e) {
            console.warn("Could not extract description from initial data");
        }
        
        // Fallback: try alternative extraction method
        if (!title) {
            const titleMatch = html.match(/<meta name="title" content="([^"]+)">/);
            if (titleMatch) {
                title = titleMatch[1];
            }
        }
        
        if (!description) {
            const descMatch = html.match(/<meta name="description" content="([^"]+)">/);
            if (descMatch) {
                description = descMatch[1];
            }
        }
        
        console.log(`✅ Metadata extracted:`);
        console.log(`   Title: ${title ? title.substring(0, 50) + '...' : 'Not found'}`);
        console.log(`   Description length: ${description ? description.length : 0} chars`);
        
        return {
            title: title || "Untitled Video",
            description: description || null,
            videoId: videoId,
            channelName: null
        };
        
    } catch (error) {
        console.error("❌ Error fetching YouTube metadata:", error.message);
        throw new Error(`Failed to fetch YouTube metadata: ${error.message}`);
    }
};

// __________-------------Check if text contains recipe-like content-------------__________
const isRecipeDescription = (text) => {
    if (!text) return false;
    
    const text_lower = text.toLowerCase();
    
    // Recipe indicators
    const ingredientPatterns = [
        /\d+\s*(cup|tbsp|tsp|g|gram|ml|oz|lb|pound|pinch|dash|teaspoon|tablespoon)/gi,
        /\b(cup|tbsp|tsp|gram|ml|oz|lb)\b/gi,
    ];
    
    const sectionPatterns = [
        /ingredients?:/i,
        /instructions?:/i,
        /directions?:/i,
        /steps?:/i,
        /method:/i,
        /procedure:/i,
    ];
    
    // Check for ingredient patterns
    let ingredientMatches = 0;
    for (const pattern of ingredientPatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            ingredientMatches += matches.length;
        }
    }
    
    // Check for section patterns
    const hasSectionMarkers = sectionPatterns.some(pattern => pattern.test(text_lower));
    
    // Must have multiple ingredient patterns
    return ingredientMatches >= 2;
};

// __________-------------Parse description into basic recipe structure-------------__________
const parseDescriptionIngredients = (description) => {
    if (!description) return [];
    
    const lines = description.split('\n').filter(line => line.trim().length > 0);
    const ingredients = [];
    
    // Regex patterns to match ingredient lines
    const ingredientPattern = /^\s*[-•✓✔️]?\s*(\d+\.?\d*|[\d/]+)\s*([a-zA-Z]*)\s+(.+?)(?:\(|$)/;
    const simpleQuantityPattern = /^(\d+\.?\d*|[\d/]+)\s+([a-zA-Z]+)\s+(.+)/;
    
    for (let line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and section headers
        if (trimmed.length === 0 || /^(ingredients?:|instructions?:|directions?:|steps?:|method:|procedure:)$/i.test(trimmed)) {
            continue;
        }
        
        // Try full pattern match
        let match = trimmed.match(ingredientPattern);
        if (match) {
            const quantity = match[1];
            const unit = match[2].trim();
            const name = match[3].trim();
            
            if (name.length > 0) {
                ingredients.push({
                    quantity: quantity || null,
                    unit: unit || null,
                    name: name,
                    section: 'Main'
                });
                continue;
            }
        }
        
        // Try simple quantity pattern
        match = trimmed.match(simpleQuantityPattern);
        if (match) {
            const quantity = match[1];
            const unit = match[2].trim();
            const name = match[3].trim();
            
            if (name.length > 0) {
                ingredients.push({
                    quantity: quantity || null,
                    unit: unit || null,
                    name: name,
                    section: 'Main'
                });
            }
        }
    }
    
    return ingredients;
};

// __________-------------Main: Extract recipe from description first-------------__________
const extractFromDescription = async (videoUrl) => {
    try {
        const metadata = await getYouTubeDescriptionByScrapy(videoUrl);
        
        console.log("✅ Metadata fetched");
        
        // Check if description looks like a recipe
        const hasRecipe = hasRecipeContent(metadata.description);
        console.log(`   Contains recipe indicators: ${hasRecipe}`);
        
        if (hasRecipe && metadata.description) {
            // Extract ingredients from description
            const ingredients = parseDescriptionIngredients(metadata.description);
            console.log(`   Found ${ingredients.length} ingredients in description`);
            
            return {
                success: true,
                source: 'description',
                description: metadata.description,
                ingredients: ingredients,
                videoTitle: metadata.title,
                videoDescription: metadata.description,
                channelName: metadata.channelName,
                duration: null,
                thumbnailUrl: null,
                ingredientCount: ingredients.length,
                message: `✅ Recipe found in description (${ingredients.length} ingredients)`
            };
        } else {
            return {
                success: false,
                source: 'description',
                description: metadata.description || null,
                videoTitle: metadata.title,
                videoDescription: metadata.description,
                channelName: metadata.channelName,
                duration: null,
                thumbnailUrl: null,
                message: "⚠️ No recipe found in description"
            };
        }
    } catch (error) {
        console.error("❌ Error in extractFromDescription:", error.message);
        throw error;
    }
};

// __________-------------Check if description has recipe content-------------__________
const hasRecipeContent = (description) => {
    return isRecipeDescription(description);
};

module.exports = {
    isRecipeDescription,
    parseDescriptionIngredients,
    getYouTubeDescriptionByScrapy,
    hasRecipeContent,
    extractFromDescription
};