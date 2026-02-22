const axios = require('axios');
const{normalizeUnit, cleanIngredientName} = require('../controllers/videoRecipeController');

// ______________________-------------------Analyze description content-----------------____________________
const analyzeDescriptionContent = (description) => {
    if (!description) return { hasIngredients: false, hasSteps: false, isEmpty: true, lineCount: 0 };
    
    const text = description.toLowerCase();
    const lines = description.split('\n').filter(l => l.trim().length > 0);
    
    const ingredientUnits = /(cup|cups|tbsp|tsp|tablespoon|teaspoon|gram|grams|g|ml|milliliter|oz|pound|lb|pinch|dash|ml|l|liter|litre|kg)\b/gi;
    const unitMatches = (description.match(ingredientUnits) || []).length;
    
    const quantityMatches = (description.match(/\b(\d+\.?\d*|\d+\/\d+)\s*(?:cup|tbsp|tsp|g|ml|oz|lb|kg|l|liter|litre)?\b/gi) || []).length;
    
    const hasIngredients = unitMatches >= 2 && quantityMatches >= 2;
    
    // Step detection - improved pattern
    const stepKeywords = /(step|instruction|direction|procedure|preheat|mix|whisk|combine|bake|cook|heat|cool|serve|spread|pour|add|place|fold|whip|blend|knead|season|drain|strain)\b/gi;
    const hasSteps = stepKeywords.test(text);
    
    // Count actual extracted ingredients for better accuracy
    const ingredientPattern = /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+)\s+([a-zA-Z\s]+?)\s+(.+?)(?:\s*\[|\s*\(|$)/gm;
    const extractedCount = (description.match(ingredientPattern) || []).length;
    
    return {
        hasIngredients: hasIngredients || extractedCount >= 5,
        hasSteps,
        isEmpty: lines.length < 3,
        ingredientCount: Math.max(unitMatches, extractedCount),
        lineCount: lines.length
    };
};

// __________-------------Extract ingredients from text with unit normalization-------------__________
const extractIngredientsFromText = (text) => {
    if (!text) return [];
    
    const ingredients = [];
    const seen = new Set();
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentSection = 'Main';
    let inIngredientsSection = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty or very long lines
        if (trimmed.length === 0 || trimmed.length > 500) continue;
        
        // Detect ingredients section header
        if (/^ingredients\s*:?\s*$/i.test(trimmed)) {
            inIngredientsSection = true;
            currentSection = 'Ingredients';
            continue;
        }
        
        // Detect other section headers (e.g., Cake Batter, Frosting)
        const sectionMatch = trimmed.match(/^[✔✓]?\s*([A-Za-z\s]+?)\s*:?\s*$/i);
        if (sectionMatch && /cake|batter|frosting|glaze|sauce|filling|topping|dough|crust|base|icing|ganache|baking|pan/i.test(trimmed)) {
            currentSection = sectionMatch[1].trim();
            inIngredientsSection = false;
            continue;
        }
        
        // Stop at instruction keywords
        if (/^(instructions|directions|steps|method|procedure|pan\s+size|mix|bake|heat|cook|fold|whisk|preheat|batter|baking|oven|temperature|°|degrees|step|instruction|direction)/i.test(trimmed)) {
            inIngredientsSection = false;
            continue;
        }
        
        // Skip pure text lines without numbers, bullets, or ingredient keywords
        if (/^[a-z\s]*$/i.test(trimmed) && !trimmed.match(/\d/) && !trimmed.match(/[-•✓✔]/) && !trimmed.match(/egg|flour|sugar|butter|milk|oil|powder|salt|soda|cream|chocolate|cocoa/i)) {
            continue;
        }
        
        // Skip header-like lines (all caps)
        if (/^[A-Z\s\-]+$/.test(trimmed)) continue;
        
        // Combined patterns from both functions, expanded for more coverage
        const patterns = [
            // Pattern 1 from #1: "Ingredient name - 1 cup (130g)" or "Ingredient - 1cup"
            /^[-•✓✔]?\s*([a-zA-Z\s]+?)\s*-\s*(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔)\s*([a-zA-Z\s]*?)(?:\s*[\(\[]|$)/i,
            // Pattern 2 from #1: "1 cup flour" or "½ cup cocoa powder"
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔)\s+([a-zA-Z\s]+?)\s+(.+?)(?:\s*\[|\s*\(|$)/i,
            // Pattern 3 from #1: "1 cup flour" (simple)
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔)\s+([a-zA-Z\s]+?)$/i,
            // Pattern 4 from #1: "Ingredient - 200g" or "Dark Chocolate - 200g"
            /^[-•✓✔]?\s*([a-zA-Z\s]+?)\s*-\s*(\d+\.?\d*)\s*([a-zA-Z]+)(?:\s*[\(\[]|$)/i,
            // Pattern from #2: "123 g ingredient" or "123ml ingredient"
            /(\d+(?:\.\d+)?)\s*(g|mg|kg|ml|l|litre|liter|tbsp|tsp|cup|cups|oz|lb|lbs|tablespoon|teaspoon|pinch|dash|handful)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
            // Pattern from #2: "1/2 teaspoon baking powder" or "3/4 cup flour"
            /(\d+\/\d+)\s+(teaspoon|tablespoon|tsp|tbsp|cup|cups|g|ml|oz|lb)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
            // Pattern from #2: "2 large eggs" or "1 egg"
            /(\d+(?:\/\d+)?)\s+(large|small|medium)?\s*([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
        ];
        
        let matched = false;
        for (const pattern of patterns) {
            let match = trimmed.match(pattern);
            if (!match && pattern.global) {
                while ((match = pattern.exec(trimmed)) !== null) {
                    // Handle global patterns
                    let quantity = match[1];
                    let rawUnit = match[2] || '';
                    let rawName = match[3]?.trim() || '';
                    
                    processMatch(quantity, rawUnit, rawName, trimmed);
                }
            } else if (match) {
                // Handle non-global patterns
                let quantity = null;
                let rawUnit = null;
                let rawName = null;
                
                // Assign based on pattern type (adjust indices per pattern)
                if (pattern === patterns[0]) {
                    rawName = match[1];
                    quantity = match[2];
                    rawUnit = match[3] || '';
                } else if (pattern === patterns[1]) {
                    quantity = match[1];
                    rawUnit = match[2];
                    rawName = match[3];
                } else if (pattern === patterns[2]) {
                    quantity = match[1];
                    rawUnit = '';
                    rawName = match[2];
                } else if (pattern === patterns[3]) {
                    rawName = match[1];
                    quantity = match[2];
                    rawUnit = match[3];
                }
                
                if (quantity && rawName) {
                    processMatch(quantity, rawUnit, rawName, trimmed);
                    matched = true;
                    break;
                }
            }
        }
        
        function processMatch(quantity, rawUnit, rawName, original) {
            // Convert special fractions to decimals
            quantity = quantity.replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/⅓/g, '0.33').replace(/⅔/g, '0.67');
            
            // Clean name: remove parentheses, trim
            const cleanName = cleanIngredientName(rawName)
                .replace(/\([^)]*\)/g, '')
                .replace(/^\s+|\s+$/g, '')
                .trim()
                .toLowerCase();
            
            // Skip invalid names
            if (cleanName.length < 2 || cleanName.length > 100) return;
            
            // Normalize unit
            const normalizedUnit = normalizeUnit(rawUnit.toLowerCase()) || rawUnit || 'pc';
            
            // Deduplication key
            const key = `${quantity}-${normalizedUnit}-${cleanName}`.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            
            // Push ingredient
            ingredients.push({
                name: cleanName,
                quantity: quantity || null,
                unit: normalizedUnit,
                section: currentSection,
                rawUnit: rawUnit,
                original: original,
                matched: !!normalizedUnit
            });
        }
    }
    
    return ingredients;
};

// __________-------------Generate complete recipe with LLM (with unit constraints)-------------__________
const generateRecipeWithLLM = async (description, videoTitle, channelTitle, extractedIngredients, topCommentsText = "") => {
    try {
        console.log("📤 Sending all data to Groq for recipe generation...");
        
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY not set in environment");
        }
        
        const systemPrompt = `You are an expert professional Chef and recipe editor specializing in creating detailed, structured recipes. KEEP THE EXISTING SYSTEM PROMPT - DON'T CHANGE IT
        
Your job is to extract a complete, human-friendly, and structured recipe from transcripts of cooking videos.

INPUT CONTEXT:
- You receive an automatic transcription of a short cooking video (may have repeated phrases, filler words, or missing words)
- You may also receive: video title, channel name, video description
- Your goal: Extract ingredients, steps, timing, temperature, and other cooking parameters
- If the recipe is not in english, make sure you translate it to english before processing it, and set the "transcript_language" field to the correct language code (e.g., "fr" for French, "es" for Spanish, etc.)

CRITICAL REQUIREMENTS:

1. **UNIT CONSTRAINT - USE METRIC SYSTEM BY DEFAULT:**
   Use ONLY: g, kg, ml, l, tsp, tbsp, pc (pieces), pinch, dash
   - Separate quantity from unit: 
     * quantity: "1", "1/2", "2-3", or number
     * unit: "kg", "g", "ml", "tbsp", "tsp", "pc", "pinch", etc.
   

2. **Title & Description**
   - Infer a clear, concise recipe title (max 255 characters)
   - Write a short description if possible (max 1000 characters)

3. **STEPS MUST BE COMPREHENSIVE AND SECTIONED:**
    - Write clear, numbered, chronological cooking steps
    - Group steps into logical sections (for example, "Prepare", "Assemble", "Cook", "Finish", "Garnish")
    - Each section should have a descriptive title
    - Each step within a section should be 2-3 sentences with actionable details.
    - If the description given is more than 2 sentences divide it more to keep each step short and actionna
    - Include specific techniques and warnings (e.g., "Don't overmix", "until smooth and lump-free")
    - Include timing/duration when relevant (stored in "duration_minutes" field)
    - Include temperature ranges when applicable
    - Provide sub-details using bullet points within step instructions

4. **INGREDIENTS MUST HAVE SECTIONS:**
    - Extract ALL ingredients mentioned, even if quantities are unclear
    - Normalize ingredient names (Keep only the core ingredient name, remove adjectives and preparation details)
    - Group ingredients by component, that will have the same name as the steps (for example, "Prepare", "Assemble", "Cook", "Finish", "Garnish")
    - If single-component, use "Main"
    - Include quantities in metric units
    - Always put the main ingredient first in the ingredient name (e.g., olive oil should be oil olive, white wignegar should be vinegar white wine, etc.)

5. **Metadata**
    - servings or portions: number of servings (or null)
    - difficulty: "Very Easy", "Easy", "Medium", "Hard", "Very Hard"
    - course_type: "Appetizer", "Main Course", "Dessert", "Snack", or "Beverage"
    - meal_type: "Breakfast", "Lunch", "Dinner", or "Snack"
    - cuisine_type: e.g., "Italian", "Asian Fusion", etc. (or null), For video-based recipes converted from online sources, ALWAYS use cuisine_type: "Homemade" if the cuisine type is not clearly mentioned.
   Do NOT attempt to guess cuisine type from video title alone.

6. **JSON OUTPUT STRUCTURE:**
    - Your MUST return ONLY a valid JSON object with this EXACT structure:

{
  "title": "Recipe Name",
  "description": "Brief professional description",
  "portions": 4,
  "prep_time": 20,
  "cook_time": 35,
  "total_time": 55,
  "difficulty": "Medium",
  "course_type": "Dessert",
  "meal_type": "Dinner",
  "cuisine_type": "Italian",
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
      "section": "Prepare",
      "step_number": 1,
      "instruction": "Preheat your oven to 170–180°C (340–355°F). While preheating, grease an 8-inch round or square cake pan with butter or cooking spray. Line the bottom with baking/parchment paper for easy removal.",
      "duration_minutes": 10,
      "sub_steps": ["Ensure oven temperature reaches target", "Paper should cover entire bottom", "Light dusting of flour on sides helps (optional)"]
    },
    {
      "section": "Prepare",
      "step_number": 2,
      "instruction": "Lightly dust the sides with flour if you want easier unmolding. Set the pan aside.",
      "duration_minutes": null,
      "sub_steps": []
    },
    {
      "section": "Assemble",
      "step_number": 3,
      "instruction": "In a large bowl, whisk together the DRY ingredients: flour, cocoa powder, sugar, salt, baking soda, and baking powder. Mix thoroughly to combine the leavening agents evenly.",
      "duration_minutes": 3,
      "sub_steps": ["Sift dry ingredients if possible to remove lumps", "Ensure baking soda and powder are evenly distributed"]
    },
    {
      "section": "Assemble",
      "step_number": 4,
      "instruction": "In a separate bowl or large jug, whisk the WET ingredients: eggs, vanilla extract, white vinegar, neutral oil, and milk until smooth and combined. The vinegar will react with the baking soda to help leaven the cake.",
      "duration_minutes": 3,
      "sub_steps": ["Whisk until eggs are fully incorporated", "Mixture should be homogeneous", "Vinegar activates baking soda"]
    },
    {
      "section": "Assemble",
      "step_number": 5,
      "instruction": "Pour the wet mixture into the dry ingredients. Using a spatula or whisk, fold together just until you have a smooth, lump-free batter. AVOID OVERMIXING – overmixing develops gluten and results in a tough cake.",
      "duration_minutes": 2,
      "sub_steps": ["Mix gently with minimum strokes", "Stop when no visible dry streaks remain", "Do NOT beat or whisk vigorously"]
    },
    {
      "section": "Assemble",
      "step_number": 6,
      "instruction": "Pour the batter into the prepared pan and tap gently on the counter 2-3 times to release large air bubbles. This helps ensure an even crumb structure.",
      "duration_minutes": 1,
      "sub_steps": ["Tap firmly but not violently", "Surface should appear relatively smooth"]
    },
    {
      "section": "Cook",
      "step_number": 7,
      "instruction": "Bake in the preheated oven for 30-35 minutes, or until a toothpick inserted into the center comes out clean. The cake is done when it springs back when lightly touched.",
      "duration_minutes": 35,
      "sub_steps": ["Check doneness with toothpick", "Cake should be firm and springy", "Do not overcook – can dry out"]
    },
    {
      "section": "Garnish",
      "step_number": 8,
      "instruction": "Once the cake is done baking and cooled, you can garnish it with powdered sugar, fresh berries, or a drizzle of glaze for presentation.",
      "duration_minutes": 5,
      "sub_steps": ["Cool completely before garnishing", "Ensure surface is dry for glaze adherence", "Garnish with decorative touches"]
    }
  ]
}

7. **VERY IMPORTANT CRITICAL NOTES:**
    - Always use CELSIUS for temperatures with Fahrenheit in parentheses (if mentionned)
    - Use in priority the metric units system for all ingredient quantities (g, kg, ml, l) pieces (pc), unless the original recipe only uses imperial units, in which case you can retain those units.
    - Never use Fractions in quantities (like 1/2 or 3/4) always use decimals (0.5, 0.75) for clarity and consistency
    - Steps must be logical, chronological, and detailed
    - Include warnings, tips, and techniques
    - Each section should have 1-7 steps with clear progression
    - Duration should be in minutes (or null if unknown) but it must alway be realistic, and complete minutes (not around 2min).
    - sub_steps should be an array of brief bullet points with extra tips
    - Do NOT include any text outside the JSON object

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
            servings: data.servings ? parseInt(data.servings) || null : (data.portions ? parseInt(data.portions) || null : null),
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

// Translate recipe in english
const translateRecipeToEnglish = async (recipe) => {
    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY not set in environment");
        }

        const systemPrompt = `You are a professional translator specializing in recipes. 
        You will receive a recipe JSON object. Your task is to translate any non-English 
        text fields to English. Preserve all numbers, quantities, units, and the JSON structure exactly. 
        Only translate the following fields if they contain text: title, description, ingredient names, 
        step instructions. For ingredient names, translate the core ingredient (e.g., "beurre" -> "butter") 
        but keep any preparation notes like "melted" if they are part of the name. For step instructions, 
        translate the full text naturally. If the recipe is already in English, return it unchanged. 
        Output ONLY the translated JSON object, no additional text.`;

        const userMessage = `Translate this recipe to English if needed:\n${JSON.stringify(recipe, null, 2)}`;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 4000,
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
            throw new Error("Invalid translation response");
        }

        const translatedRecipe = JSON.parse(response.data.choices[0].message.content);
        return translatedRecipe;
    } catch (error) {
        console.error("❌ Translation error:", error.message);
        // If translation fails, return original recipe (don't block)
        return recipe;
    }
};


module.exports = {
    extractIngredientsFromText,
    analyzeDescriptionContent,
    generateRecipeWithLLM,
    sanitizeRecipe,
    extractSections,
    translateRecipeToEnglish
};