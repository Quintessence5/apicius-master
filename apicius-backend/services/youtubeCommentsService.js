const axios = require('axios');

// __________-------------Fetch YouTube Comments-------------__________
const fetchYouTubeComments = async (videoId, maxResults = 100) => {
    try {
        console.log(`\n⛏️ ========== MINING YOUTUBE COMMENTS FOR RECIPE DATA ==========\n`);
        console.log(`⛏️ Step 1: Fetching up to ${maxResults} comments...`);

        // Use youtube-comment-api or fallback to simple fetch
        const comments = [];
        
        try {
            // Try using youtube-transcript-api which also gets comments
            const { YoutubeTranscript } = await import('youtube-transcript');
            // Note: This might not have comments, so we'll use alternative
        } catch (e) {
            // Fallback approach
        }

        // For now, we'll use a free API that can fetch YouTube comments
        try {
            const apiUrl = `https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO90d0o_cstNMrZizcK6IqC4Oy4dq9KS0`;
            
            const response = await axios.post(apiUrl, {
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20211221.06.00',
                    }
                },
                videoId: videoId,
            }, {
                timeout: 10000
            });

            // Extract comments from response
            // This is complex, so we'll use a simpler approach
        } catch (apiError) {
            console.log("⚠️ YouTube API approach failed, using alternative...");
        }

        // Simpler approach: Return a placeholder that the user can fill in
        // In production, you'd want to use a proper YouTube comment API
        console.log(`✅ Comment fetching requires API key. Using manual parsing for now.`);
        
        return comments;

    } catch (error) {
        console.error("❌ Error fetching comments:", error.message);
        return [];
    }
};

// __________-------------Extract Ingredients with BETTER PARSING-------------__________
const extractIngredientsFromText = (text) => {
    const ingredients = [];
    
    // Better regex patterns for ingredient detection
    const patterns = [
        // Pattern: "123 g ingredient name" or "123ml ingredient"
        /(\d+(?:\.\d+)?)\s*(g|ml|tbsp|tsp|cup|cups|oz|lb|lbs|kg|l|litre|tablespoon|teaspoon|pinch|dash|handful)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
        // Pattern: "1/2 teaspoon baking powder"
        /(\d+\/\d+|\d+)\s+(teaspoon|tablespoon|tsp|tbsp|cup|cups|g|ml|oz|lb)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
        // Pattern: "2 large eggs" or "3/4 teaspoon salt"
        /(\d+(?:\/\d+)?)\s+(large|small|medium)?\s*([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
    ];

    // Split text into lines and process
    const lines = text.split('\n');
    
    for (const line of lines) {
        // Skip empty lines and section headers
        if (!line.trim() || line.match(/^[A-Z\s\-]+$/)) continue;
        
        // Skip lines that don't look like ingredients
        if (!line.match(/\d|\(|\)/) && !line.match(/egg|flour|sugar|butter|milk|oil|powder|salt|soda/i)) {
            continue;
        }

        // Apply patterns
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const quantity = match[1];
                const unit = match[2];
                const name = match[3]?.trim().toLowerCase();

                if (name && name.length > 2) {
                    ingredients.push({
                        quantity: quantity,
                        unit: unit,
                        name: name,
                        original: line.trim()
                    });
                }
            }
        }
    }

    return ingredients;
};

// __________-------------Extract Sections (Cake, Frosting, Baking)-------------__________
const extractSections = (text) => {
    const sections = {};
    const lines = text.split('\n');
    let currentSection = 'main';
    let sectionContent = [];

    for (const line of lines) {
        // Detect section headers
        if (line.match(/^(ingredients|frosting|icing|cake|baking|instructions|directions|method|topping|filling)\s*:?/i)) {
            if (sectionContent.length > 0) {
                sections[currentSection] = sectionContent.join('\n');
            }
            currentSection = line.toLowerCase().replace(/\s*:?\s*$/, '');
            sectionContent = [];
        } else {
            sectionContent.push(line);
        }
    }

    if (sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n');
    }

    return sections;
};

// __________-------------Mine Comments for Recipe Data-------------__________
const mineCommentsForRecipe = (commentTexts) => {
    console.log(`\n🔍 Step 2: Filtering for recipe content...\n`);
    
    let allExtractedIngredients = [];
    let scores = [];
    
    // Score each comment for recipe-relevance
    const scoredComments = commentTexts.map(comment => {
        let score = 0;
        
        // Give points for ingredient keywords
        if (comment.match(/\d+\s*(g|ml|cup|tbsp|tsp|oz|lb)/i)) score += 30; // Has measurements
        if (comment.match(/flour|sugar|butter|eggs|milk|oil|baking/i)) score += 20;
        if (comment.match(/ingredient|recipe|ingredients|measurement/i)) score += 15;
        if (comment.match(/metric|imperial|version/i)) score += 10;
        if (comment.match(/frosting|icing|topping|filling/i)) score += 10;
        if (comment.match(/\n/)) score += 5; // Multiple lines = likely structured
        
        // Penalize short comments
        if (comment.length < 20) score -= 10;
        
        return { comment, score };
    });

    // Sort by score and take top comments
    const topComments = scoredComments
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    console.log(`🔍 Filtering comments for recipe content...`);
    console.log(`✅ Found ${topComments.length} comments with recipe-like content (score: ${topComments.map(c => c.score).join(', ')})\n`);

    // Extract ingredients from top comments
    console.log(`🥘 Step 3: Extracting ingredients from comments...\n`);
    
    for (const { comment, score } of topComments) {
        if (score < 8) continue; // Skip low-scoring comments
        
        const extracted = extractIngredientsFromText(comment);
        allExtractedIngredients = allExtractedIngredients.concat(extracted);
        scores.push(score);
    }

    console.log(`✅ Extracted ${allExtractedIngredients.length} ingredient entries from ${topComments.length} comments\n`);

    // Deduplicate and normalize
    console.log(`🔄 Step 4: Normalizing and deduplicating ingredients...\n`);
    
    const normalized = normalizeIngredients(allExtractedIngredients);
    
    const qualityScore = Math.min(100, Math.round(
        (normalized.length / 20) * 50 + // Ingredient count (0-50 points)
        (topComments.length / 10) * 30 + // Comment count (0-30 points)
        (scores.reduce((a, b) => a + b, 0) / scores.length / 3) // Average score (0-20 points)
    ));

    console.log(`✅ Final ingredient count: ${normalized.length} unique ingredients`);
    console.log(`📊 Mining quality score: ${qualityScore}/100\n`);

    return {
        ingredients: normalized,
        topComments: topComments.slice(0, 5).map(c => c.comment),
        qualityScore: qualityScore
    };
};

// __________-------------Normalize Ingredients (Remove Duplicates)-------------__________
const normalizeIngredients = (ingredients) => {
    const normalized = new Map();

    for (const ing of ingredients) {
        // Create a normalized key (removing articles, measurements)
        const key = ing.name
            .replace(/^\d+\s*/, '') // Remove leading numbers
            .replace(/^(a|an|the)\s+/i, '') // Remove articles
            .trim()
            .toLowerCase();

        if (key.length < 3) continue; // Skip very short names

        // If we already have this ingredient, merge the data
        if (normalized.has(key)) {
            const existing = normalized.get(key);
            // Keep the most complete version
            if (ing.quantity && !existing.quantity) {
                existing.quantity = ing.quantity;
            }
            if (ing.unit && !existing.unit) {
                existing.unit = ing.unit;
            }
        } else {
            normalized.set(key, {
                quantity: ing.quantity,
                unit: ing.unit,
                name: ing.name.toLowerCase(),
                originalName: ing.name
            });
        }
    }

    return Array.from(normalized.values());
};

// __________-------------Parse Top Comment Directly (BEST APPROACH)-------------__________
const parseTopCommentAsRecipe = (topCommentText) => {
    console.log(`\n🔍 DEEP PARSING TOP COMMENT AS PRIMARY RECIPE SOURCE\n`);
    
    // Extract sections from the comment
    const sections = extractSections(topCommentText);
    
    console.log(`✅ Detected sections:`, Object.keys(sections));
    
    // Extract all ingredients from all sections
    let allIngredients = [];
    for (const [section, content] of Object.entries(sections)) {
        const ingredients = extractIngredientsFromText(content);
        console.log(`   - ${section}: ${ingredients.length} ingredients`);
        allIngredients = allIngredients.concat(ingredients);
    }

    const normalized = normalizeIngredients(allIngredients);
    console.log(`\n✅ Total unique ingredients from top comment: ${normalized.length}\n`);

    return {
        ingredients: normalized,
        sections: sections,
        qualityScore: 95 // Top comment is usually high quality
    };
};

module.exports = {
    fetchYouTubeComments,
    extractIngredientsFromText,
    extractSections,
    mineCommentsForRecipe,
    normalizeIngredients,
    parseTopCommentAsRecipe
};