const axios = require('axios');

// __________-------------Groq LLM Integration Service-------------__________
const transcriptToRecipeService = async (transcript) => {
    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY environment variable is not set");
        }

        const systemPrompt = `You are an expert recipe extraction AI. Your task is to analyze cooking-related transcripts and extract structured recipe data.

IMPORTANT: You MUST respond ONLY with valid JSON (no markdown, no explanation text before or after).

Extract the following from the transcript and return as JSON:
{
  "title": "Recipe name",
  "servings": "Number of servings (numeric or null)",
  "prep_time": "Prep time in minutes (numeric or null)",
  "cook_time": "Cook time in minutes (numeric or null)",
  "difficulty": "Very Easy, Easy, Medium, Hard, or Very Hard",
  "course_type": "Appetizer, Main Course, Dessert, Snack, or Beverage",
  "meal_type": "Breakfast, Lunch, Dinner, or Snack",
  "cuisine_type": "Italian, Chinese, Indian, Mexican, French, or Others",
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": numeric or null,
      "unit": "cup, tbsp, tsp, g, ml, oz, lb, etc. or null"
    }
  ],
  "steps": [
    "First instruction",
    "Second instruction",
    "..."
  ],
  "notes": "Any additional tips or notes (optional)",
  "source": "Source of the recipe if mentioned"
}

Rules:
- Extract ALL ingredients mentioned with quantities
- Instructions must be step-by-step and clear
- If information is missing, use null for numeric values and empty strings for text
- Default values if not mentioned: servings=1, difficulty="Medium", course_type="Main Course", meal_type="Dinner", cuisine_type="Others"
- Return ONLY the JSON object, nothing else`;

        console.log("📤 Sending request to Groq API...");

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
                        content: `Extract recipe from this transcript:\n\n${transcript}`
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
        console.log("Raw LLM Response:", responseText.substring(0, 200) + "...");

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

        return sanitizedRecipe;

    } catch (error) {
        console.error("❌ Error in transcriptToRecipeService:", error.message);
        
        if (error.response?.status === 429) {
            throw new Error("Groq API rate limit exceeded. Please try again in a few moments.");
        } else if (error.response?.status === 401) {
            throw new Error("Invalid Groq API key. Check your credentials.");
        } else if (error.code === 'ECONNABORTED') {
            throw new Error("Request to Groq API timed out. Try a shorter transcript.");
        }
        
        throw error;
    }
};

// __________-------------Sanitize and Validate Recipe Data-------------__________
const sanitizeRecipeData = (data) => {
    const validCoursTypes = ['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage'];
    const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const validCuisineTypes = ['Italian', 'Chinese', 'Indian', 'Mexican', 'French', 'Others'];
    const validDifficulties = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

    return {
        title: String(data.title || 'Untitled Recipe').substring(0, 255),
        servings: parseInt(data.servings) || 1,
        prep_time: parseInt(data.prep_time) || 0,
        cook_time: parseInt(data.cook_time) || 0,
        total_time: (parseInt(data.prep_time) || 0) + (parseInt(data.cook_time) || 0),
        difficulty: validDifficulties.includes(data.difficulty) ? data.difficulty : 'Medium',
        course_type: validCoursTypes.includes(data.course_type) ? data.course_type : 'Main Course',
        meal_type: validMealTypes.includes(data.meal_type) ? data.meal_type : 'Dinner',
        cuisine_type: validCuisineTypes.includes(data.cuisine_type) ? data.cuisine_type : 'Others',
        portions: parseInt(data.servings) || 1,
        source: String(data.source || 'Video').substring(0, 255),
        notes: String(data.notes || '').substring(0, 1000),
        ingredients: Array.isArray(data.ingredients) 
            ? data.ingredients.filter(ing => ing.name).map(ing => ({
                name: String(ing.name).substring(0, 255),
                quantity: ing.quantity ? parseFloat(ing.quantity) : null,
                unit: ing.unit ? String(ing.unit).substring(0, 50) : null
              }))
            : [],
        steps: Array.isArray(data.steps)
            ? data.steps.filter(step => step && typeof step === 'string')
            : [],
        public: false
    };
};

module.exports = {
    transcriptToRecipeService,
    sanitizeRecipeData
};