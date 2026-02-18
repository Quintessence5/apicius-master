const axios = require('axios');

// Standardized units mapping
const VALID_UNITS = {
    // Weight
    'g': { name: 'Gram', abbreviation: 'g', type: 'weight' },
    'kg': { name: 'Kilogram', abbreviation: 'kg', type: 'weight' },
    'mg': { name: 'Milligram', abbreviation: 'mg', type: 'weight' },
    'oz': { name: 'Ounce', abbreviation: 'oz', type: 'weight' },
    'lb': { name: 'Pound', abbreviation: 'lb', type: 'weight' },
    't': { name: 'Ton', abbreviation: 't', type: 'weight' },
    
    // Volume
    'ml': { name: 'Milliliter', abbreviation: 'ml', type: 'volume' },
    'l': { name: 'Liter', abbreviation: 'l', type: 'volume' },
    'tsp': { name: 'Teaspoon', abbreviation: 'tsp', type: 'volume' },
    'tbsp': { name: 'Tablespoon', abbreviation: 'tbsp', type: 'volume' },
    'fl oz': { name: 'Fluid Ounce', abbreviation: 'fl oz', type: 'volume' },
    'pt': { name: 'Pint', abbreviation: 'pt', type: 'volume' },
    'qt': { name: 'Quart', abbreviation: 'qt', type: 'volume' },
    'gal': { name: 'Gallon', abbreviation: 'gal', type: 'volume' },
    
    // Quantity
    'pc': { name: 'Piece', abbreviation: 'pc', type: 'quantity' },
    'doz': { name: 'Dozen', abbreviation: 'doz', type: 'quantity' },
    'pinch': { name: 'Pinch', abbreviation: 'pinch', type: 'quantity' },
    'dash': { name: 'Dash', abbreviation: 'dash', type: 'quantity' },
    'cup': { name: 'Cup', abbreviation: 'cup', type: 'quantity' }
};

// Normalize unit to standard abbreviation
const normalizeUnit = (unit) => {
    if (!unit) return null;
    
    const cleanUnit = unit.toLowerCase().trim();
    
    // Direct match
    if (VALID_UNITS[cleanUnit]) return cleanUnit;
    
    // Common aliases
    const aliases = {
        'cups': 'cup',
        'gram': 'g',
        'grams': 'g',
        'kilogram': 'kg',
        'kilograms': 'kg',
        'ounce': 'oz',
        'ounces': 'oz',
        'pound': 'lb',
        'pounds': 'lb',
        'milliliter': 'ml',
        'milliliters': 'ml',
        'liter': 'l',
        'liters': 'l',
        'teaspoon': 'tsp',
        'teaspoons': 'tsp',
        'tablespoon': 'tbsp',
        'tablespoons': 'tbsp',
        'fluidounce': 'fl oz',
        'fluidounces': 'fl oz',
        'pint': 'pt',
        'pints': 'pt',
        'quart': 'qt',
        'quarts': 'qt',
        'gallon': 'gal',
        'gallons': 'gal',
        'piece': 'pc',
        'pieces': 'pc',
        'dozen': 'doz',
        'mg': 'mg'
    };
    
    if (aliases[cleanUnit]) return aliases[cleanUnit];
    
    return null;
};

// Clean ingredient name (remove adjectives and descriptions)
const cleanIngredientName = (name) => {
    if (!name) return '';
    
    const cleaned = name
        .toLowerCase()
        .trim()
        // Remove common descriptive phrases
        .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses content
        .replace(/\s*\[.*?\]\s*/g, '') // Remove brackets content
        .replace(/\s+(large|medium|small|fresh|dried|ground|minced|chopped|diced|sliced|grated|melted|room temperature|cold|warm)\s*/gi, '')
        .replace(/\s+(unsweetened|sweetened|all-purpose|whole wheat|neutral|cooking|light|extra virgin)\s*/gi, '')
        .replace(/\s+about\s*/gi, '')
        .replace(/\s+or\s+.+$/gi, '') // Remove "or alternative" suggestions
        .replace(/\s+–.+$/gi, '') // Remove dashes and descriptions
        .replace(/\s+[–\-].+$/gi, '')
        .trim();
    
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

// __________-------------Get YouTube Video Description via Official API-------------__________
const getYouTubeDescription = async (videoUrl) => {
    try {
        console.log("📄 Fetching YouTube video description...");
        
        const videoIdMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
        if (!videoIdMatch) {
            throw new Error("Invalid YouTube URL format");
        }
        
        const videoId = videoIdMatch[1];
        const apiKey = process.env.YOUTUBE_API_KEY;
        
        if (!apiKey) {
            throw new Error("YOUTUBE_API_KEY not set in environment variables");
        }
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                id: videoId,
                part: 'snippet',
                key: apiKey
            },
            timeout: 10000
        });
        
        if (!response.data.items || response.data.items.length === 0) {
            throw new Error("Video not found or is private");
        }
        
        const videoData = response.data.items[0].snippet;
        
        return {
            title: videoData.title || null,
            description: videoData.description || null,
            channelTitle: videoData.channelTitle || null,
            videoId: videoId
        };
        
    } catch (error) {
        console.error("❌ Error fetching YouTube description:", error.message);
        throw error;
    }
};

// __________-------------Extract ingredients from text with unit normalization-------------__________
const extractIngredientsFromText = (text) => {
    if (!text) return [];
    
    const ingredients = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentSection = 'Main';
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect section headers
        const sectionMatch = trimmed.match(/^[✔✓]?\s*([A-Za-z\s]+)$/i);
        if (sectionMatch && /batter|ganache|frosting|glaze|sauce|filling|topping|dough|crust|base/i.test(trimmed)) {
            currentSection = trimmed.replace(/^[✔✓]\s*/, '').trim();
            continue;
        }
        
        // Skip instructions
        if (/^(\d+\.|step|instruction|direction|procedure|preheat|mix|bake|cool|serve)/i.test(trimmed)) {
            continue;
        }
        
        // Try to parse as ingredient line
        const ingredientPatterns = [
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+)\s+([a-zA-Z\s]+?)\s+(.+?)(?:\s*\[|\s*\(|$)/,
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+)\s+([a-zA-Z\s]+?)\s+(.+)/,
        ];
        
        for (const pattern of ingredientPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                const quantity = match[1];
                const rawUnit = match[2].trim();
                const rawName = match[3].replace(/\s*[\[\(].*[\]\)]/, '').trim();
                
                const normalizedUnit = normalizeUnit(rawUnit);
                const cleanName = cleanIngredientName(rawName);
                
                if (cleanName.length > 0 && cleanName.length < 200) {
                    ingredients.push({
                        name: cleanName,
                        quantity: quantity || null,
                        unit: normalizedUnit || rawUnit,
                        section: currentSection,
                        rawUnit: rawUnit,
                        matched: !!normalizedUnit // Flag if unit was matched to standard
                    });
                    break;
                }
            }
        }
    }
    
    return ingredients;
};

// __________-------------Analyze description content-------------__________
const analyzeDescriptionContent = (description) => {
    if (!description) return { hasIngredients: false, hasSteps: false, isEmpty: true };
    
    const text = description.toLowerCase();
    const lines = description.split('\n').filter(l => l.trim().length > 0);
    
    const ingredientUnits = /(cup|cups|tbsp|tsp|tablespoon|teaspoon|gram|grams|g|ml|milliliter|oz|pound|lb|pinch|dash)\b/gi;
    const unitMatches = (description.match(ingredientUnits) || []).length;
    const quantityMatches = (description.match(/\b\d+\.?\d*\s*(\/\s*\d+)?\b/g) || []).length;
    
    const hasIngredients = unitMatches >= 3 && quantityMatches >= 5;
    const stepKeywords = /(step|instruction|direction|procedure|preheat|mix|whisk|combine|bake|cook|heat|cool|serve|spread|pour|add|place)/gi;
    const hasSteps = stepKeywords.test(text);
    
    return {
        hasIngredients,
        hasSteps,
        isEmpty: lines.length < 3,
        ingredientCount: unitMatches,
        lineCount: lines.length
    };
};

// __________-------------Generate complete recipe with LLM (with unit constraints)-------------__________
const generateRecipeWithLLM = async (description, videoTitle, channelTitle, extractedIngredients, topCommentsText = "") => {
    try {
        console.log("📤 Sending all data to Groq for recipe generation...");
        
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY not set in environment");
        }
        
        const systemPrompt = `You are an expert professional Chef and recipe editor specializing in creating detailed, structured recipes. KEEP THE EXISTING SYSTEM PROMPT - DON'T CHANGE IT
        

CRITICAL REQUIREMENTS:

1. **UNIT CONSTRAINT - USE METRIC SYSTEM BY DEFAULT:**
   Use ONLY: g, kg, ml, l, tsp, tbsp, pc (pieces), pinch, dash

2. **STEPS MUST BE COMPREHENSIVE AND SECTIONED:**
   - Group steps into logical sections (e.g., "Prepare the pan and oven", "Make the cake batter", "Bake", "Make the ganache", "Assemble and serve")
   - Each section should have a descriptive title
   - Each step within a section should be 2-4 sentences with actionable details
   - Include specific techniques and warnings (e.g., "Don't overmix", "until smooth and lump-free")
   - Include timing/duration when relevant (stored in "duration_minutes" field)
   - Include temperature ranges when applicable
   - Provide sub-details using bullet points within step instructions

3. **INGREDIENTS MUST HAVE SECTIONS:**
   - Group ingredients by component (e.g., "Cake Batter", "Ganache", "Topping")
   - If single-component, use "Main"
   - Include quantities in metric units

4. **JSON OUTPUT STRUCTURE:**
   Your MUST return ONLY a valid JSON object with this EXACT structure:

5 **CUISINE TYPE:**
   For video-based recipes converted from online sources, ALWAYS use cuisine_type: "Homemade"
   Do NOT attempt to guess cuisine type from video title alone.

{
  "title": "Recipe Name",
  "description": "Brief professional description",
  "servings": 4,
  "prep_time": 20,
  "cook_time": 35,
  "total_time": 55,
  "difficulty": "Medium",
  "course_type": "Dessert",
  "meal_type": "Dinner",
  "cuisine_type": "Western",
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": "2",
      "unit": "pc",
      "section": "Cake Batter"
    }
  ],
  "steps": [
    {
      "section": "Prepare the pan and oven",
      "step_number": 1,
      "instruction": "Preheat your oven to 170–180°C (340–355°F). While preheating, grease an 8-inch round or square cake pan with butter or cooking spray. Line the bottom with baking/parchment paper for easy removal.",
      "duration_minutes": 10,
      "sub_steps": ["Ensure oven temperature reaches target", "Paper should cover entire bottom", "Light dusting of flour on sides helps (optional)"]
    },
    {
      "section": "Prepare the pan and oven",
      "step_number": 2,
      "instruction": "Lightly dust the sides with flour if you want easier unmolding. Set the pan aside.",
      "duration_minutes": null,
      "sub_steps": []
    },
    {
      "section": "Make the cake batter",
      "step_number": 3,
      "instruction": "In a large bowl, whisk together the DRY ingredients: flour, cocoa powder, sugar, salt, baking soda, and baking powder. Mix thoroughly to combine the leavening agents evenly.",
      "duration_minutes": 3,
      "sub_steps": ["Sift dry ingredients if possible to remove lumps", "Ensure baking soda and powder are evenly distributed"]
    },
    {
      "section": "Make the cake batter",
      "step_number": 4,
      "instruction": "In a separate bowl or large jug, whisk the WET ingredients: eggs, vanilla extract, white vinegar, neutral oil, and milk until smooth and combined. The vinegar will react with the baking soda to help leaven the cake.",
      "duration_minutes": 3,
      "sub_steps": ["Whisk until eggs are fully incorporated", "Mixture should be homogeneous", "Vinegar activates baking soda"]
    },
    {
      "section": "Make the cake batter",
      "step_number": 5,
      "instruction": "Pour the wet mixture into the dry ingredients. Using a spatula or whisk, fold together just until you have a smooth, lump-free batter. AVOID OVERMIXING – overmixing develops gluten and results in a tough cake.",
      "duration_minutes": 2,
      "sub_steps": ["Mix gently with minimum strokes", "Stop when no visible dry streaks remain", "Do NOT beat or whisk vigorously"]
    },
    {
      "section": "Make the cake batter",
      "step_number": 6,
      "instruction": "Pour the batter into the prepared pan and tap gently on the counter 2-3 times to release large air bubbles. This helps ensure an even crumb structure.",
      "duration_minutes": 1,
      "sub_steps": ["Tap firmly but not violently", "Surface should appear relatively smooth"]
    }
  ]
}

5. **CRITICAL NOTES:**
   - Always use CELSIUS for temperatures with Fahrenheit in parentheses
   - Steps must be logical, chronological, and detailed
   - Include warnings, tips, and techniques
   - Each section should have 2-7 steps with clear progression
   - Duration should be in minutes (or null if unknown) but it must alway be realistic.
   - sub_steps should be an array of brief bullet points with extra tips

OUTPUT: Return ONLY valid JSON. No markdown, no explanations, no backticks.`;

        let userMessage = `Video Title: "${videoTitle || 'Unknown'}"\n`;
        userMessage += `Channel: ${channelTitle || 'Unknown'}\n\n`;
        userMessage += `Description:\n${description || '(No description provided)'}\n\n`;
        
        if (topCommentsText && topCommentsText.trim().length > 50) {
            console.log(`📝 Including top YouTube comments as recipe reference (${topCommentsText.length} chars)`);
            userMessage += `⭐ TOP YOUTUBE COMMENTS WITH RECIPE DETAILS:\n${topCommentsText}\n\n`;
        }

        if (extractedIngredients && extractedIngredients.length > 0) {
            userMessage += `Pre-extracted ingredients (already cleaned and standardized):\n`;
            extractedIngredients.forEach(ing => {
                userMessage += `- ${ing.quantity || '?'} ${ing.unit} ${ing.name} (${ing.section})\n`;
            });
        }
        
        userMessage += `\n\nCREATE A COMPREHENSIVE, DETAILED RECIPE with:
- Multiple step sections with clear titles
- Detailed instructions (2-4 sentences each)
- Duration estimates for each step
- Specific techniques and warnings
- Sub-steps with tips
- Metric units (grams, ml, celsius)
- Grouped ingredients by component`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.5,
                max_tokens: 4000, // Increase to allow for more detailed content
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        if (!response.data.choices?.[0]?.message?.content) {
            throw new Error("Invalid response from Groq API");
        }
        
        const responseText = response.data.choices[0].message.content;
        console.log("📥 Raw LLM Response received, parsing JSON...");
        
        let recipeData;
        try {
            recipeData = JSON.parse(responseText);
        } catch (parseError) {
            console.error("JSON Parse Error, attempting to extract JSON...");
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                recipeData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Failed to extract JSON from LLM response");
            }
        }
        
        console.log("✅ JSON parsed successfully");
        return sanitizeRecipe(recipeData);
        
    } catch (error) {
        console.error("❌ Error in generateRecipeWithLLM:", error.message);
        throw error;
    }
};

// __________-------------Sanitize and validate recipe-------------__________
const sanitizeRecipe = (data) => {
    try {
        return {
            title: data.title ? String(data.title).substring(0, 255) : "Untitled Recipe",
            description: data.description ? String(data.description).substring(0, 1000) : null,
            servings: data.servings ? parseInt(data.servings) || null : null,
            prep_time: data.prep_time ? parseInt(data.prep_time) || null : null,
            cook_time: data.cook_time ? parseInt(data.cook_time) || null : null,
            total_time: data.total_time ? parseInt(data.total_time) || null : null,
            baking_temperature: data.baking_temperature ? parseInt(data.baking_temperature) || null : null,
            baking_time: data.baking_time ? parseInt(data.baking_time) || null : null,
            difficulty: ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'].includes(data.difficulty)
                ? data.difficulty
                : "Medium",
            course_type: ['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage'].includes(data.course_type)
                ? data.course_type
                : "Main Course",
            meal_type: ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(data.meal_type)
                ? data.meal_type
                : "Dinner",
            cuisine_type: data.cuisine_type ? String(data.cuisine_type).substring(0, 100) : null,
            ingredients: Array.isArray(data.ingredients)
                ? data.ingredients.map(ing => ({
                    name: String(ing.name || '').substring(0, 255),
                    quantity: ing.quantity ? String(ing.quantity) : null,
                    unit: ing.unit ? String(ing.unit).substring(0, 50) : null,
                    section: ing.section ? String(ing.section).substring(0, 100) : "Main"
                })).filter(ing => ing.name.length > 0)
                : [],
            // Support BOTH structured and simple step formats
            steps: Array.isArray(data.steps)
                ? data.steps.map((step, idx) => {
                    if (typeof step === 'string') {
                        // Convert simple string to structured format
                        return {
                            section: 'Main',
                            step_number: idx + 1,
                            instruction: step.substring(0, 1000),
                            duration_minutes: null,
                            sub_steps: []
                        };
                    }
                    if (step && typeof step === 'object') {
                        return {
                            section: step.section ? String(step.section).substring(0, 100) : 'Main',
                            step_number: step.step_number || idx + 1,
                            instruction: step.instruction ? String(step.instruction).substring(0, 1000) : '',
                            duration_minutes: step.duration_minutes ? parseInt(step.duration_minutes) || null : null,
                            sub_steps: Array.isArray(step.sub_steps) 
                                ? step.sub_steps.map(s => String(s).substring(0, 300))
                                : []
                        };
                    }
                    return null;
                }).filter(Boolean)
                : [],
            notes: data.notes ? String(data.notes).substring(0, 2000) : null,
            tags: Array.isArray(data.tags) ? data.tags.map(t => String(t).substring(0, 50)) : [],
            public: typeof data.public === 'boolean' ? data.public : false
        };
    } catch (error) {
        console.error("❌ Error sanitizing recipe:", error);
        throw new Error("Failed to validate recipe data");
    }
};

// __________-------------Get YouTube Video Thumbnail-------------__________
const getYouTubeThumbnail = (videoId) => {
    try {
        // YouTube provides several thumbnail quality options
        // maxresdefault is highest quality, but not always available
        // sddefault is usually available for most videos
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
        return thumbnailUrl;
    } catch (error) {
        console.error("Error getting YouTube thumbnail:", error);
        return null;
    }
};


module.exports = {
    getYouTubeDescription,
    extractIngredientsFromText,
    analyzeDescriptionContent,
    generateRecipeWithLLM,
    sanitizeRecipe,
    normalizeUnit,
    cleanIngredientName,
    getYouTubeThumbnail,
    VALID_UNITS
};