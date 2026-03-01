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

    const systemPrompt = `You are an expert recipe parser. Extract the recipe from the provided image. The image may be a cookbook page, handwritten note, or screenshot. Return a JSON object following this exact structure:

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

Rules:
- Use metric units (g, kg, ml, l, tsp, tbsp, pc) if available. If only imperial, keep them.
- Convert fractions to decimals (e.g., "1/2" → "0.5").
- Group ingredients into sections exactly as they appear.
- Steps must be chronological, with section headings. Include durations if mentioned.
- Extract servings, prep/cook/total times, difficulty, course/meal/cuisine types if present.
- If any field is missing, set it to null (do not omit).
- Output ONLY the JSON, no extra text.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-vision-preview',
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
 * Fallback: OCR with Tesseract + LLM
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Object|null>} Recipe object or null
 */
async function extractWithOcrAndLLM(imagePath) {
  try {
    console.log('🔍 Running OCR with Tesseract...');
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(`Tesseract: ${m.status}`),
    });

    if (!text || text.trim().length < 50) {
      throw new Error('OCR returned insufficient text');
    }

    console.log(`✅ OCR extracted ${text.length} characters`);

    // Use existing LLM function from videoToRecipeService
    const recipe = await generateRecipeWithLLM(text, 'Image Recipe', null, [], '', '');
    return recipe;
  } catch (error) {
    console.error('❌ OCR + LLM fallback failed:', error.message);
    return null;
  }
}

/**
 * Main extraction function – tries vision first, then OCR+LLM
 * @param {string} imagePath - Path to the image file
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<Object>} Extracted recipe (raw, not yet sanitized)
 */
async function extractRecipeFromImage(imagePath, mimeType) {
  // Try primary vision API
  let recipe = await extractWithOpenAIVision(imagePath, mimeType);
  if (recipe) return recipe;

  // Fallback to OCR + LLM
  console.log('⚠️ Vision API failed, falling back to OCR + LLM');
  recipe = await extractWithOcrAndLLM(imagePath);
  if (recipe) return recipe;

  throw new Error('All extraction methods failed');
}

module.exports = { extractRecipeFromImage };