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
const generateRecipeWithLLM = async (description, videoTitle, channelTitle, extractedIngredients) => {
    try {
        console.log("📤 Sending all data to Groq for recipe generation...");
        
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY not set in environment");
        }
        
        const systemPrompt = `You are an expert professional baker and recipe editor.

Your job is to create a complete, structured recipe from whatever information is provided about a cooking video.

CRITICAL UNIT CONSTRAINT:
You MUST use ONLY these units for ingredients. NO OTHER UNITS ALLOWED:
Weight: g, kg, mg, oz, lb, t
Volume: ml, l, tsp, tbsp, fl oz, pt, qt, gal
Quantity: pc, doz, pinch, dash, cup

CRITICAL NAME CONSTRAINT:
Ingredient names MUST be:
- Basic, simple names WITHOUT adjectives or descriptions
- Example: "flour" not "all-purpose flour" or "wheat flour"
- Example: "sugar" not "granulated sugar"
- Example: "milk" not "fresh whole milk"
- Example: "butter" not "unsalted room temperature butter"

THIS IS ESSENTIAL FOR DATABASE MATCHING!

INPUT DATA YOU MAY RECEIVE:
- Video title
- Channel name
- Description text (may contain ingredients, steps, or both)
- Pre-extracted ingredients from description

YOUR JOB:
1. Use ALL information provided
2. Parse ingredients carefully with BASIC NAMES and STANDARD UNITS ONLY
3. If steps are missing, generate realistic steps from expert knowledge
4. Infer oven temperature, baking times, servings from context
5. Group ingredients by component (e.g., "Cake Batter", "Ganache")

OUTPUT: Return ONLY valid JSON (no markdown, no explanation).

JSON STRUCTURE:
{
  "title": "Recipe Name",
  "description": "Professional short description",
  "servings": 4,
  "prep_time": 15,
  "cook_time": 30,
  "total_time": 45,
  "baking_temperature": 350,
  "baking_time": 25,
  "difficulty": "Medium",
  "course_type": "Dessert",
  "meal_type": "Dinner",
  "cuisine_type": null,
  "ingredients": [
    {
      "name": "flour",
      "quantity": "2",
      "unit": "cup",
      "section": "Cake Batter"
    },
    {
      "name": "sugar",
      "quantity": "1",
      "unit": "cup",
      "section": "Cake Batter"
    }
  ],
  "steps": ["Step 1...", "Step 2...", "..."],
  "notes": null,
  "tags": []
}

REMEMBER: Simple ingredient names, standard units only!`;

        let userMessage = `Video Title: "${videoTitle || 'Unknown'}"\n`;
        userMessage += `Channel: ${channelTitle || 'Unknown'}\n\n`;
        userMessage += `Description:\n${description || '(No description provided)'}\n\n`;
        
        if (extractedIngredients && extractedIngredients.length > 0) {
            userMessage += `Pre-extracted ingredients (already cleaned and standardized):\n`;
            extractedIngredients.forEach(ing => {
                userMessage += `- ${ing.quantity || '?'} ${ing.unit} ${ing.name} (${ing.section})\n`;
            });
        }
        
        userMessage += `\nGenerate a complete, professional recipe JSON with BASIC ingredient names and STANDARD units ONLY.`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.5,
                max_tokens: 3000,
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
            difficulty: ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'].includes(data.difficulty) ? data.difficulty : "Medium",
            course_type: ['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage'].includes(data.course_type) ? data.course_type : "Main Course",
            meal_type: ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(data.meal_type) ? data.meal_type : "Dinner",
            cuisine_type: data.cuisine_type ? String(data.cuisine_type).substring(0, 100) : null,
            ingredients: Array.isArray(data.ingredients)
                ? data.ingredients
                    .map(ing => ({
                        name: String(ing.name || '').substring(0, 255),
                        quantity: ing.quantity ? String(ing.quantity) : null,
                        unit: normalizeUnit(String(ing.unit)) || String(ing.unit).substring(0, 50),
                        section: ing.section ? String(ing.section).substring(0, 100) : "Main"
                    }))
                    .filter(ing => ing.name.length > 0)
                : [],
            steps: Array.isArray(data.steps)
                ? data.steps
                    .map(step => typeof step === 'string' ? step.substring(0, 500) : (step?.instruction?.substring(0, 500) || null))
                    .filter(step => step && step.trim().length > 0)
                : [],
            notes: data.notes ? String(data.notes).substring(0, 2000) : null,
            tags: Array.isArray(data.tags) ? data.tags.map(t => String(t).substring(0, 50)).slice(0, 10) : [],
            public: false
        };
    } catch (error) {
        console.error("❌ Error sanitizing recipe:", error);
        throw new Error("Failed to validate recipe data");
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
    VALID_UNITS
};