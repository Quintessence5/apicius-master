const axios = require('axios');

// System prompt for extracting recipe from description
const DESCRIPTION_RECIPE_PROMPT = `You are an expert recipe parser and food scientist.

Your job is to convert raw recipe descriptions or text into a structured, standardized recipe format.

INPUT: You will receive raw recipe description text, which may be:
- Manually written recipe with sections
- Video description with ingredients and instructions mixed
- User notes from a cooking video
- Any cooking-related text

OUTPUT: Return a complete, structured recipe as JSON.

EXTRACTION RULES:

1. **Title & Description**
   - Use the video title or infer from content (max 255 chars)
   - Write a brief description (max 1000 chars)

2. **Ingredients**
   - Extract ALL ingredients with quantities and units
   - Normalize units: "cup" not "cups", "tbsp" not "tablespoon"
   - Group into sections where appropriate (e.g., "For the cake:", "For frosting:")
   - Format: quantity (number or string like "1/2"), unit (cup, tbsp, g, ml, etc.), name

3. **Steps**
   - Extract clear, numbered cooking instructions
   - If no explicit steps, infer them from ingredient descriptions
   - Keep steps clear and actionable

4. **Timing & Temperature**
   - prep_time: prep time in minutes (null if not mentioned)
   - cook_time: cooking time in minutes (null if not mentioned)
   - baking_temperature: oven temp in Fahrenheit (null if not mentioned)
   - baking_time: baking time in minutes (null if not mentioned)

5. **Metadata**
   - difficulty: "Very Easy", "Easy", "Medium", "Hard", "Very Hard"
   - course_type: "Appetizer", "Main Course", "Dessert", "Snack", "Beverage"
   - meal_type: "Breakfast", "Lunch", "Dinner", "Snack"
   - cuisine_type: e.g., "Italian", "Asian Fusion" (null if unclear)
   - servings: number of servings (null if not mentioned)

IMPORTANT:
- Return ONLY valid JSON, no markdown, no explanations
- If a field cannot be determined, use null
- Default difficulty: "Medium"
- Default course_type: "Main Course"
- Default meal_type: "Dinner"
- Be generous with ingredient parsing; extract as much as you can

JSON Schema:
{
  "title": "Recipe Name",
  "description": "Short description",
  "servings": null or number,
  "prep_time": null or number,
  "cook_time": null or number,
  "total_time": null or number,
  "baking_temperature": null or number,
  "baking_time": null or number,
  "difficulty": "Medium|Easy|Hard|etc",
  "course_type": "Main Course|Dessert|etc",
  "meal_type": "Dinner|Breakfast|etc",
  "cuisine_type": null or string,
  "ingredients": [{"name": "...", "quantity": "1" or null, "unit": "cup" or null, "section": "Main"}],
  "steps": ["Step 1", "Step 2", ...],
  "notes": null or string,
  "tags": ["tag1", "tag2"]
}`;

// __________-------------Extract recipe from description via Groq LLM-------------__________
const descriptionToRecipeService = async (description, metadata = {}) => {
    const startTime = Date.now();
    
    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY environment variable is not set");
        }

        if (!description || typeof description !== 'string' || description.trim().length === 0) {
            throw new Error("Description cannot be empty");
        }

        console.log("📤 Sending description to Groq LLM for recipe extraction...");

        // Build user message with metadata
        let userMessage = `Extract recipe from this description:\n\n${description}`;
        
        if (metadata.videoTitle) {
            userMessage += `\n\nVideo Title: ${metadata.videoTitle}`;
        }
        if (metadata.channelName) {
            userMessage += `\n\nChannel: ${metadata.channelName}`;
        }

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: DESCRIPTION_RECIPE_PROMPT
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                temperature: 0.5, // Lower temp for more consistent parsing
                max_tokens: 2000,
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

        console.log("✅ Groq API response received");

        if (!response.data.choices || !response.data.choices[0]) {
            throw new Error("Invalid response format from Groq API");
        }

        const responseText = response.data.choices[0].message.content;

        // Parse the JSON response
        let recipeData;
        try {
            recipeData = JSON.parse(responseText);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                recipeData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Failed to parse LLM response as JSON");
            }
        }

        // Validate and sanitize
        const sanitizedRecipe = sanitizeRecipeData(recipeData);
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ Recipe extracted from description in ${processingTime}ms`);

        return {
            recipe: sanitizedRecipe,
            processingTime,
            rawResponse: recipeData,
            source: 'description'
        };

    } catch (error) {
        console.error("❌ Error in descriptionToRecipeService:", error.message);
        
        if (error.response?.status === 429) {
            throw new Error("Groq API rate limit exceeded. Please try again later.");
        } else if (error.response?.status === 401) {
            throw new Error("Groq API key is invalid or expired");
        }
        
        throw error;
    }
};

// __________-------------Sanitize and validate recipe data (same as transcript service)-------------__________
const sanitizeRecipeData = (data) => {
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
                    .map((step, idx) => {
                        if (typeof step === 'string') {
                            return step.substring(0, 500);
                        }
                        if (step && step.instruction) {
                            return step.instruction.substring(0, 500);
                        }
                        return null;
                    })
                    .filter(step => step && step.trim().length > 0)
                : [],
            notes: data.notes ? String(data.notes).substring(0, 2000) : null,
            tags: Array.isArray(data.tags) 
                ? data.tags.map(t => String(t).substring(0, 50)).slice(0, 10)
                : [],
            public: false
        };
    } catch (error) {
        console.error("❌ Error sanitizing recipe data:", error);
        throw new Error("Failed to validate recipe data structure");
    }
};

module.exports = {
    descriptionToRecipeService,
    sanitizeRecipeData,
    DESCRIPTION_RECIPE_PROMPT
};