const axios = require('axios');

// __________-------------Fetch YouTube Comments-------------__________
const fetchYouTubeComments = async (videoId, maxResults = 100) => {
    try {
        console.log(`\n⛏️ ========== MINING YOUTUBE COMMENTS FOR RECIPE DATA ==========\n`);
        console.log(`⛏️ Step 1: Fetching up to ${maxResults} comments...`);

       if (!process.env.YOUTUBE_API_KEY) {
            throw new Error("YOUTUBE_API_KEY not configured");
        }

        const response = await axios.get(
            'https://www.googleapis.com/youtube/v3/commentThreads',
            {
                params: {
                    part: 'snippet',
                    videoId: videoId,
                    textFormat: 'plainText',
                    maxResults: 100,
                    order: 'relevance',
                    key: process.env.YOUTUBE_API_KEY
                },
                timeout: 15000
            }
        );

        if (!response.data.items || response.data.items.length === 0) {
            console.warn("⚠️ No comments found for this video");
            return [];
        }

        const comments = response.data.items
            .map(item => item.snippet.topLevelComment.snippet.textDisplay)
            .filter(text => text && text.length > 20);

        console.log(`✅ Fetched ${comments.length} comments`);
        return comments;

    } catch (error) {
        console.error("❌ Error fetching YouTube comments:", error.message);
        return [];
    }
};


// __________-------------Extract Ingredients with BETTER PARSING-------------__________
const extractIngredientsFromText = (text) => {
    const ingredients = [];
    
    // Better regex patterns for ingredient detection
    const patterns = [
        // Pattern: "123 g ingredient" or "123ml ingredient" 
        /(\d+(?:\.\d+)?)\s*(g|mg|kg|ml|l|litre|liter|tbsp|tsp|cup|cups|oz|lb|lbs|tablespoon|teaspoon|pinch|dash|handful)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
        // Pattern: "1/2 teaspoon baking powder" or "3/4 cup flour"
        /(\d+\/\d+)\s+(teaspoon|tablespoon|tsp|tbsp|cup|cups|g|ml|oz|lb)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
        // Pattern: "2 large eggs" or "1 egg"
        /(\d+(?:\/\d+)?)\s+(large|small|medium)?\s*([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
    ];

    // Split text into lines and process
    const lines = text.split('\n');
    const seen = new Set();
    
    for (const line of lines) {
        // Skip empty, header lines, or very long lines
        if (!line.trim() || line.match(/^[A-Z\s\-]+$/) || line.length > 500) continue;
        
        // Skip instruction lines
        if (/^(mix|bake|heat|cook|fold|whisk|preheat|batter|baking|oven|temperature|°|degrees|step|instruction|direction)/i.test(line.trim())) {
            continue;
        }

        // Skip lines without numbers or ingredient keywords
        if (!line.match(/\d|\(|\)/) && !line.match(/egg|flour|sugar|butter|milk|oil|powder|salt|soda|cream|chocolate|cocoa/i)) {
            continue;
        }

        // Apply patterns
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                let quantity = match[1];
                let unit = match[2] || '';
                let name = match[3]?.trim().toLowerCase() || '';

                // Clean up name
                name = name
                    .replace(/\([^)]*\)/g, '')
                    .replace(/^\s+|\s+$/g, '')
                    .trim();

                // Skip very short or very long names
                if (name.length < 2 || name.length > 100) continue;

                // Create unique key
                const key = `${quantity}-${unit}-${name}`.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);

                ingredients.push({
                    quantity: quantity,
                    unit: unit || null,
                    name: name,
                    original: line.trim()
                });
                break;
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
        if (line.match(/^(ingredients|frosting|icing|cake|baking|instructions|directions|method|topping|filling|ganache)\s*:?/i)) {
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
const mineRecipeFromComments = (commentTexts) => {
    console.log(`\n🔍 Step 2: Analyzing top comments for recipe content...\n`);
    
    if (!commentTexts || commentTexts.length === 0) {
        console.warn("⚠️ No comments to analyze");
        return {
            found: false,
            reason: "No comments available",
            ingredients: [],
            topComments: [],
            qualityScore: 0
        };
    }

    // STEP 1: Score comments based on recipe relevance
    console.log(`📊 Scoring ${Math.min(commentTexts.length, 20)} comments for recipe relevance...`);
    
    const scoredComments = commentTexts.slice(0, 20).map((comment, index) => {
        let score = 0;
        
        // Has actual measurements
        if (comment.match(/(\d+\.?\d*)\s*(g|ml|cup|tbsp|tsp|oz|lb|litre)/gi)) {
            score += 35;
            console.log(`   Comment ${index + 1}: Has measurements (+35)`);
        }
        
        // Has ingredient keywords
        if (comment.match(/flour|sugar|butter|eggs|milk|oil|baking|powder|soda|cream|chocolate|cocoa|salt|vanilla/i)) {
            score += 25;
        }
        
        // Has structure (multiple lines)
        const lineCount = (comment.match(/\n/g) || []).length;
        if (lineCount > 3) {
            score += 15;
            console.log(`   Comment ${index + 1}: Has structure, ${lineCount} lines (+15)`);
        }
        
        // Has cooking instructions
        if (comment.match(/bake|mix|heat|cook|oven|temperature|preheat|fold|whisk/i)) {
            score += 10;
        }
        
        // Has imperial/metric versions
        if (comment.match(/metric|imperial|version|\/\//)) {
            score += 5;
        }
        
        // Penalize very short comments
        if (comment.length < 50) score -= 20;
        
        return {
            text: comment,
            score: Math.max(0, score),
            index: index
        };
    });

    // STEP 2: Get top 5-10 comments
    const topScored = scoredComments
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    console.log(`\n✅ Top ${topScored.length} comments selected:`);
    topScored.forEach(c => {
        console.log(`   - Comment ${c.index + 1}: Score ${c.score}`);
    });

    // STEP 3: Extract ingredients from top comments
    console.log(`\n🥘 Extracting ingredients from top comments...`);
    
    let allIngredients = [];
    let commentSources = [];

    for (const scored of topScored) {
        if (scored.score < 5) continue;

        const extracted = extractIngredientsFromText(scored.text);
        
        if (extracted.length > 0) {
            console.log(`   - Comment ${scored.index + 1}: Found ${extracted.length} ingredients`);
            allIngredients = allIngredients.concat(extracted);
            commentSources.push(scored.text);
        }
    }

    if (allIngredients.length === 0) {
        console.warn("⚠️ No ingredients extracted from comments");
        return {
            found: false,
            reason: "No ingredients found in comments",
            ingredients: [],
            topComments: [],
            qualityScore: 0
        };
    }

    // STEP 4: Normalize and deduplicate
    console.log(`\n🔄 Normalizing ${allIngredients.length} ingredient entries...`);
    
    const normalized = normalizeIngredients(allIngredients);
    
    console.log(`✅ Final count: ${normalized.length} unique ingredients`);

    // STEP 5: Calculate quality score
    const qualityScore = Math.min(100, Math.round(
        (normalized.length / 25) * 40 +          // Ingredient count (0-40)
        (topScored.length / 10) * 30 +           // Comment count (0-30)
        (topScored.reduce((a, b) => a + b.score, 0) / topScored.length / 2) // Avg score (0-30)
    ));

    console.log(`📊 Mining quality score: ${qualityScore}/100\n`);

    return {
        found: true,
        ingredientCount: normalized.length,
        sourceCommentCount: commentSources.length,
        commentQuality: qualityScore,
        ingredients: normalized,
        topComments: commentSources, // Array of full comment texts
        qualityScore: qualityScore
    };
};

// __________-------------Normalize Ingredients (Remove Duplicates)-------------__________
const normalizeIngredients = (ingredients) => {
    const normalized = new Map();

    for (const ing of ingredients) {
        const key = ing.name
            .replace(/^\d+\s*/, '')
            .replace(/^(a|an|the)\s+/i, '')
            .trim()
            .toLowerCase();

        if (key.length < 3) continue;

        if (normalized.has(key)) {
            const existing = normalized.get(key);
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

    return Array.from(normalized.values()).map(ing => ({
        quantity: ing.quantity,
        unit: ing.unit,
        name: ing.originalName || ing.name,
        section: 'Main'
    }));
};

module.exports = {
    fetchYouTubeComments,
    extractIngredientsFromText,
    extractSections,
    mineRecipeFromComments,
    normalizeIngredients
};