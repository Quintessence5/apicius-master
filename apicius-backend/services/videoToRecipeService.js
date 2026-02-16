const axios = require('axios');

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

// __________-------------Extract ingredients from raw description text (simple parsing)-------------__________
const extractIngredientsFromText = (text) => {
    if (!text) return [];
    
    const ingredients = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentSection = 'Main';
    let inIngredientsSection = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect section headers (✔, ✓, words like "Batter", "Ganache", "Frosting", etc.)
        const sectionMatch = trimmed.match(/^[✔✓]?\s*([A-Za-z\s]+)$/i);
        if (sectionMatch && /batter|ganache|frosting|glaze|sauce|filling|topping|dough|crust|base/i.test(trimmed)) {
            currentSection = trimmed.replace(/^[✔✓]\s*/, '').trim();
            inIngredientsSection = true;
            continue;
        }
        
        // Skip if line is clearly a step/instruction
        if (/^(\d+\.|step|instruction|direction|procedure|preheat|mix|bake|cool|serve)/i.test(trimmed)) {
            inIngredientsSection = false;
            continue;
        }
        
        // Try to parse as ingredient line
        // Patterns: "2 cups flour", "1/2 tsp vanilla", "1 tbsp butter", etc.
        const ingredientPatterns = [
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+)\s+([a-zA-Z]+)\s+(.+?)(?:\s*\[|\s*\(|$)/,  // "2 cups flour [120g]"
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+)\s+([a-zA-Z]+)\s+(.+)/,  // "2 cups flour"
            /^[-•✓✔]?\s*(.+?)\s+\((\d+\.?\d*|\d+\/\d+)\s+([a-zA-Z]+)\)/,  // "eggs (2 large)"
        ];
        
        for (const pattern of ingredientPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                let quantity, unit, name;
                
                if (pattern === ingredientPatterns[0] || pattern === ingredientPatterns[1]) {
                    quantity = match[1];
                    unit = match[2];
                    name = match[3].replace(/\s*[\[\(].*[\]\)]/, '').trim();
                } else {
                    name = match[1];
                    quantity = match[2];
                    unit = match[3];
                }
                
                if (name.length > 0 && name.length < 200) {
                    ingredients.push({
                        name: name,
                        quantity: quantity || null,
                        unit: unit || null,
                        section: currentSection
                    });
                    inIngredientsSection = true;
                    break;
                }
            }
        }
    }
    
    return ingredients;
};

// __________-------------Count meaningful content in description-------------__________
const analyzeDescriptionContent = (description) => {
    if (!description) return { hasIngredients: false, hasSteps: false, isEmpty: true };
    
    const text = description.toLowerCase();
    const lines = description.split('\n').filter(l => l.trim().length > 0);
    
    // Check for ingredients
    const ingredientUnits = /(cup|cups|tbsp|tsp|tablespoon|teaspoon|gram|grams|g|ml|milliliter|oz|pound|lb|pinch|dash)\b/gi;
    const unitMatches = (description.match(ingredientUnits) || []).length;
    const quantityMatches = (description.match(/\b\d+\.?\d*\s*(\/\s*\d+)?\b/g) || []).length;
    
    const hasIngredients = unitMatches >= 3 && quantityMatches >= 5;
    
    // Check for steps/instructions
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

// __________-------------Main LLM call: Generate complete recipe from all available data-------------__________
const generateRecipeWithLLM = async (description, videoTitle, channelTitle, extractedIngredients) => {
    try {
        console.log("📤 Sending all data to Groq for recipe generation...");
        
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY not set in environment");
        }
        
        // Build a detailed system prompt that handles partial data
        const systemPrompt = `You are an expert professional baker and recipe editor.

Your job is to create a complete, structured recipe from whatever information is provided about a cooking video.

INPUT DATA YOU MAY RECEIVE:
- Video title (e.g., "Moist Chocolate Cake with Chocolate Ganache")
- Channel name
- Description text (may contain ingredients, steps, temperatures, or all of the above)
- Extracted ingredients from the description

YOUR JOB:
1. Use ALL the information provided from the description
2. If ingredients are present, parse them carefully and group by component (e.g., "Cake Batter", "Ganache")
3. If steps are NOT in the description, use your expert knowledge of standard baking practices to generate realistic, detailed steps
4. Infer oven temperature, baking times, and servings from context (standard for this type of recipe)
5. Make everything feel authentic and professional

OUTPUT: Return ONLY a valid, parseable JSON object (no markdown, no explanation text outside JSON).

IMPORTANT RULES:
- Ingredients MUST be grouped by section when there are multiple components
- Each ingredient MUST have: name, quantity, unit, section
- Steps MUST be numbered and logically ordered
- If temperature is mentioned, include it (in Fahrenheit preferred)
- Difficulty should be: "Very Easy", "Easy", "Medium", "Hard", "Very Hard"
- Course type: "Appetizer", "Main Course", "Dessert", "Snack", "Beverage"
- Meal type: "Breakfast", "Lunch", "Dinner", "Snack"
- Use null for unknown numeric values
- Be generous and complete - this is a REAL recipe being saved

JSON STRUCTURE (you MUST return EXACTLY this):
{
  "title": "Recipe Name",
  "description": "Professional short description",
  "servings": 4,
  "prep_time": 15,
  "cook_time": 30,
  "total_time": 45,
  "baking_temperature": 350,
  "baking_time": 30,
  "difficulty": "Medium",
  "course_type": "Dessert",
  "meal_type": "Dinner",
  "cuisine_type": null,
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": "1",
      "unit": "cup",
      "section": "Section Name"
    }
  ],
  "steps": [
    "Detailed step 1...",
    "Detailed step 2...",
    "..."
  ],
  "notes": null,
  "tags": []
}`;

        // Build user message with all available data
        let userMessage = `Video Title: "${videoTitle || 'Unknown'}"\n`;
        userMessage += `Channel: ${channelTitle || 'Unknown'}\n\n`;
        userMessage += `Description/Transcript:\n${description || '(No description provided)'}\n\n`;
        
        if (extractedIngredients && extractedIngredients.length > 0) {
            userMessage += `Pre-extracted ingredients from the description:\n`;
            extractedIngredients.forEach(ing => {
                userMessage += `- ${ing.quantity || '?'} ${ing.unit || '?'} ${ing.name} (${ing.section})\n`;
            });
        }
        
        userMessage += `\nUsing ALL the above information, generate a complete, professional recipe JSON.`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                temperature: 0.6,  // Slightly higher for more creativity when filling gaps
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
        
        // Parse JSON response
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

// __________-------------Sanitize recipe data-------------__________
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
                        unit: ing.unit ? String(ing.unit).substring(0, 50) : null,
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
    sanitizeRecipe
};