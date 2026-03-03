const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const Tesseract = require('tesseract.js');
const { generateRecipeWithLLM } = require('../videoToRecipeService');

/**
 * Try to extract recipe using OpenAI GPT‑4 Vision (primary)
 * @param {string} imagePath - Path to the image file
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<Object|null>} Recipe object or null
 */
async function extractWithOpenAIVision(imagePath, mimeType) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY not set, skipping vision API');
    return null;
  }

  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const systemPrompt = `You are an expert recipe parser. Extract the recipe from the provided image. The image may be a cookbook page, handwritten note, or screenshot. 
- Your goal: Extract ingredients, steps, timing, temperature, and other cooking parameters
**Title & Description**
   - Infer a clear, concise recipe title (max 255 characters)
   - Write a short description if possible (max 1000 characters)
**STEPS MUST BE COMPREHENSIVE AND SECTIONED:**
    - Write clear, numbered, chronological cooking steps
    - Group steps into logical sections (for example, "Prepare", "Assemble", "Cook", "Finish", "Garnish")
    - Each section should have a descriptive title
    - Each step within a section should be 2-3 sentences with actionable details.
    - If the description given is more than 2 sentences divide it more to keep each step short and actionna
    - Include specific techniques and warnings (e.g., "Don't overmix", "until smooth and lump-free")
    - Include timing/duration when relevant (stored in "duration_minutes" field)
    - Include temperature ranges when applicable
    - Provide sub-details using bullet points within step instructions

**Important:** 
- If the recipe text is not in English, translate it to English.
- Format the recipe in a modern, step‑by‑step style with clear sections.
- Group ingredients under section headings (e.g., "Cake Batter", "Frosting") if they appear in the image.
- Use metric units (g, kg, ml, l, tsp, tbsp, pc) whenever possible; if only imperial units are present, keep them.
- Convert fractions to decimals (e.g., "1/2" → "0.5").
- Steps must be chronological, with section headings. Include durations (in minutes) if mentioned.
- Extract servings, prep/cook/total times, difficulty, course/meal/cuisine types if present; otherwise set to null.
- Return a JSON object following this exact structure:

{
  "title": "Recipe Name",
  "description": "Brief summary",
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
      "name": "flour",
      "quantity": "2.5",
      "unit": "cup",
      "section": "Cake Batter"
    }
  ],
  "steps": [
    {
      "section": "Prepare",
      "step_number": 1,
      "instruction": "Preheat oven to 180°C...",
      "duration_minutes": 10,
      "sub_steps": ["Use parchment paper", "Grease the pan"]
    }
  ]
}

Output ONLY the JSON, no extra text.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o', // updated model (vision-capable)
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0].message.content;
    let recipeData;
    try {
      recipeData = JSON.parse(content);
    } catch (parseErr) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) recipeData = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse JSON from OpenAI response');
    }

    console.log('✅ Vision API extraction successful');
    return recipeData;
  } catch (error) {
    console.error('❌ OpenAI Vision API error:', error.message);
    return null;
  }
}

/**
 * Fallback: OCR with Tesseract + LLM (only if tesseract.js is installed)
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Object|null>} Recipe object or null
 */
async function extractWithOcrAndLLM(imagePath) {
  if (!Tesseract) {
    console.log('⚠️ Tesseract not available – skipping OCR fallback');
    return null;
  }

  try {
    console.log('🔍 Running OCR with Tesseract...');
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(`Tesseract: ${m.status}`),
    });

    if (!text || text.trim().length < 50) {
      throw new Error('OCR returned insufficient text');
    }

    console.log(`✅ OCR extracted ${text.length} characters`);

    // Add instruction to translate and format in the supplemental parameter
    const supplemental = `IMPORTANT: 
- If the recipe text is not in English, translate it to English.
- Format the recipe in a modern, step‑by‑step style with clear sections.
- Group ingredients under section headings if present.
- Convert fractions to decimals.
- Use metric units where possible.`;

    // Use existing LLM function with supplemental instruction
    const recipe = await generateRecipeWithLLM(
      text,                 // description (the OCR text)
      'Image Recipe',       // title (will be overridden)
      null,                 // channel
      [],                   // extractedIngredients (empty, we rely on LLM)
      '',                   // topCommentsText
      supplemental,         // supplemental instruction
      ''                    // audioTranscriptText
    );

    return recipe;
  } catch (error) {
    console.error('❌ OCR + LLM fallback failed:', error.message);
    return null;
  }
}

/**
 * Main extraction function – tries OCR first (cost-effective), then Vision.
 * @param {string} imagePath - Path to the image file
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<Object>} Extracted recipe (raw, not yet sanitized)
 */
async function extractRecipeFromImage(imagePath, mimeType) {
  let recipe = null;

  // Try OCR first (if Tesseract available)
  if (Tesseract) {
    console.log('🔍 Attempting OCR first (cost-effective)...');
    recipe = await extractWithOcrAndLLM(imagePath);
    // If OCR produced a reasonable recipe (at least 3 ingredients and some steps), return it
    if (recipe && recipe.ingredients && recipe.ingredients.length >= 3 && recipe.steps && recipe.steps.length > 0) {
      console.log('✅ OCR + LLM produced a valid recipe');
      return recipe;
    } else {
      console.log('⚠️ OCR result insufficient, falling back to Vision API');
    }
  } else {
    console.log('⚠️ Tesseract not installed, skipping OCR');
  }

  // Try Vision API (if key is available)
  if (process.env.OPENAI_API_KEY) {
    recipe = await extractWithOpenAIVision(imagePath, mimeType);
    if (recipe) return recipe;
  }

  throw new Error('All extraction methods failed');
}

module.exports = { extractRecipeFromImage };