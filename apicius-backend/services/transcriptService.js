const axios = require('axios');
const { z } = require('zod');

// __________-------------Advanced Groq System Prompt for Recipe Extraction-------------__________
const SYSTEM_PROMPT = `You are an expert professional recipe editor and food scientist.

Your job is to extract a complete, human-friendly, and structured recipe from transcripts of cooking videos.

INPUT CONTEXT:
- You receive an automatic transcription of a short cooking video (may have repeated phrases, filler words, or missing words)
- You may also receive: video title, channel name, video description
- Your goal: Extract ingredients, steps, timing, temperature, and other cooking parameters

EXTRACTION RULES:

1. **Title & Description**
   - Infer a clear, concise recipe title (max 255 characters)
   - Write a short description if possible (max 1000 characters)

2. **Ingredients**
   - Extract ALL ingredients mentioned, even if quantities are unclear
   - Normalize ingredient names (e.g., "tbsp" → "tbsp", "butter" → "butter")
   - Separate quantity from unit: 
     * quantity: "1", "1/2", "2-3", or number (do NOT include units here)
     * unit: "cup", "tbsp", "g", "ml", "oz", "lb", "pinch", etc.
   - Group ingredients by section if the recipe has multiple components (e.g., "Cake Batter", "Frosting")
   - Use section: "Main" for single-component recipes

3. **Steps**
   - Write clear, numbered, chronological cooking steps
   - Merge repeated instructions and remove irrelevant chatter
   - Each step should be 1-3 sentences, actionable and specific
   - If duration is mentioned for a step, record it

4. **Timing & Temperature**
   - prep_time: preparation time in minutes (or null if not mentioned)
   - cook_time: active cooking time in minutes (or null if not mentioned)
   - total_time: complete recipe time in minutes (or null, can be prep + cook)
   - baking_temperature: oven temperature in Fahrenheit (or null)
   - baking_time: oven/baking time in minutes (or null)

5. **Metadata**
   - servings: number of servings (or null)
   - difficulty: "Very Easy", "Easy", "Medium", "Hard", "Very Hard"
   - course_type: "Appetizer", "Main Course", "Dessert", "Snack", or "Beverage"
   - meal_type: "Breakfast", "Lunch", "Dinner", or "Snack"
   - cuisine_type: e.g., "Italian", "Asian Fusion", etc. (or null)

6. **Output Format**
   - Return ONLY a valid JSON object (no markdown, no backticks, no explanations)
   - Match this exact structure:

\`\`\`json
{
  "title": "Recipe Name",
  "description": "Short description of the dish",
  "servings": 4,
  "prep_time": 15,
  "cook_time": 30,
  "total_time": 45,
  "baking_temperature": 350,
  "baking_time": 25,
  "difficulty": "Medium",
  "course_type": "Main Course",
  "meal_type": "Dinner",
  "cuisine_type": "Italian",
  "ingredients": [
    {
      "name": "all-purpose flour",
      "quantity": "2",
      "unit": "cup",
      "section": "Main"
    },
    {
      "name": "sugar",
      "quantity": "1",
      "unit": "cup",
      "section": "Main"
    }
  ],
  "steps": [
    "Preheat oven to 350°F.",
    "In a large bowl, mix flour and sugar.",
    "Add eggs and vanilla extract, stir well."
  ],
  "notes": "Do not overmix the batter. Can be made ahead and stored.",
  "tags": ["easy", "classic", "family-friendly"]
}
\`\`\`

IMPORTANT:
- If data is missing, use null (for numbers) or empty string (for text)
- Use in priority the metric units system for all ingredient quantities (g, kg, ml, l) pieces (pc), unless the original recipe explicitly uses, imperial unit in which case you can retain those units.
- Never use Fractions in quantities (like 1/2 or 3/4) always use decimals (0.5, 0.75) for clarity and consistency
- Default values if NOT mentioned: servings=null, difficulty="Medium", course_type="Main Course", meal_type="Dinner", cuisine_type=null
- Ensure all ingredient quantities and units are realistic and accurate
- Do NOT include any text outside the JSON object
`;

// __________-------------Improved Groq LLM Integration Service-------------__________
const transcriptToRecipeService = async (transcript, metadata = {}) => {
    const startTime = Date.now();
    
    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY environment variable is not set");
        }

        if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
            throw new Error("Transcript cannot be empty");
        }

        console.log("📤 Sending transcript to Groq LLM for recipe extraction...");

        // Build user message with available metadata
        let userMessage = `Extract recipe from this transcript:\n\n${transcript}`;
        
        if (metadata.videoTitle) {
            userMessage += `\n\nVideo Title: ${metadata.videoTitle}`;
        }
        if (metadata.videoDescription) {
            userMessage += `\n\nVideo Description: ${metadata.videoDescription}`;
        }
        if (metadata.channelName) {
            userMessage += `\n\nChannel Name: ${metadata.channelName}`;
        }

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                temperature: 0.7,
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
        console.log("Raw LLM Response:", responseText.substring(0, 300) + "...");

        // Parse the JSON response
        let recipeData;
        try {
            recipeData = JSON.parse(responseText);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            // Attempt to extract JSON from response if wrapped in markdown
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                recipeData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Failed to parse LLM response as JSON");
            }
        }

        // Validate and sanitize the response
        const sanitizedRecipe = sanitizeRecipeData(recipeData);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Recipe extracted successfully in ${processingTime}ms`);

        return {
            recipe: sanitizedRecipe,
            processingTime,
            rawResponse: recipeData
        };

    } catch (error) {
        console.error("❌ Error in transcriptToRecipeService:", error.message);
        
        if (error.response?.status === 429) {
            throw new Error("Groq API rate limit exceeded (30 requests/min). Please try again later.");
        } else if (error.response?.status === 401) {
            throw new Error("Groq API key is invalid or expired");
        } else if (error.response?.status === 500) {
            throw new Error("Groq API server error. Please try again later.");
        }
        
        throw error;
    }
};

// __________-------------Sanitize and Validate Recipe Data-------------__________
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
                ? data.ingredients.map(ing => ({
                    name: String(ing.name || '').substring(0, 255),
                    quantity: ing.quantity ? String(ing.quantity) : null,
                    unit: ing.unit ? String(ing.unit).substring(0, 50) : null,
                    section: ing.section ? String(ing.section).substring(0, 100) : "Main"
                })).filter(ing => ing.name.length > 0)
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
    transcriptToRecipeService,
    sanitizeRecipeData,
    SYSTEM_PROMPT
};