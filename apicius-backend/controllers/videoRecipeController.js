const pool = require('../config/db');
const { Client } = require('pg');

const nameNormalizationCache = new Map();

// ________________________--------------Match ingredients with database-------------_____________________
const matchIngredientsWithDatabase = async (ingredients) => {
    try {
        console.log(`\n🔗 Matching ${ingredients.length} ingredients with database...`);
        
        const matched = [];
        const unmatched = [];
        
        for (const ingredient of ingredients) {
            const result = await matchSingleIngredient(ingredient);
            
            if (result.found) {
                matched.push(result);
                console.log(`   ✅ "${ingredient.name}" → "${result.dbName}"`);
            } else {
                unmatched.push(result);
                console.log(`   ⚠️ "${ingredient.name}" (will be created)`);
            }
        }
        
        console.log(`\n📊 Match Summary: ${matched.length} matched, ${unmatched.length} unmatched`);
        
        return {
            all: [...matched, ...unmatched],
            matched,
            unmatched,
            matchPercentage: Math.round((matched.length / ingredients.length) * 100)
        };
        
    } catch (error) {
        console.error("❌ Error matching ingredients:", error);
        throw error;
    }
};

// ________________________--------------Smart Ingredient Matching Function-------------__________
const matchSingleIngredient = async (ingredient) => {
    try {
        const searchName = ingredient.name.toLowerCase().trim();
        
        // Strategy 1: Exact case-insensitive match
        console.log(`   🔍 Searching for: "${searchName}"`);
        
        let result = await pool.query(
            `SELECT id, name FROM ingredients WHERE LOWER(TRIM(name)) = $1 LIMIT 1`,
            [searchName]
        );
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'exact'
            };
        }
        
        // Strategy 2: Partial/substring match (e.g., "eggs" matches "egg")
        console.log(`   🔍 Trying substring match...`);
        
        result = await pool.query(
            `SELECT id, name FROM ingredients 
             WHERE LOWER(name) LIKE $1 OR LOWER($2) LIKE '%' || LOWER(name) || '%'
             ORDER BY LENGTH(name) ASC
             LIMIT 1`,
            [`%${searchName}%`, searchName]
        );
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'partial'
            };
        }
        
        // Strategy 3: Fuzzy matching (remove common suffixes/prefixes)
        console.log(`   🔍 Trying normalized / canonical match...`);
const normalized = normalizeIngredientNameForMatching(searchName);

result = await pool.query(`
    SELECT id, name 
    FROM ingredients 
    WHERE LOWER(name) = $1
       OR LOWER(name) LIKE $2
       OR LOWER(name) LIKE $3
       OR $4 LIKE '%' || LOWER(name) || '%'
    ORDER BY 
        CASE 
            WHEN LOWER(name) = $1 THEN 0
            WHEN LOWER(name) = $4 THEN 1
            WHEN LOWER(name) LIKE $2 THEN 2
            WHEN LOWER(name) LIKE $3 THEN 3
            ELSE 4
        END,
        LENGTH(name) ASC
    LIMIT 1
`, [
    normalized,                 // exact normalized
    `${normalized}%`,           // starts with normalized
    `%${normalized}%`,          // contains normalized
    searchName                  // original contains db name
]);

if (result.rows.length > 0) {
    return {
        ...ingredient,
        dbId: result.rows[0].id,
        dbName: result.rows[0].name,
        found: true,
        icon: '✅',
        matchType: 'normalized'
    };
}
        
        // Strategy 4: Similar ingredients (like "flour type 55" for "flour")
        console.log(`   🔍 Trying similar ingredient match...`);
        
        result = await pool.query(
            `SELECT id, name FROM ingredients 
             WHERE LOWER(name) LIKE $1
             ORDER BY 
               CASE 
                 WHEN LOWER(name) = $2 THEN 0
                 WHEN LOWER(name) LIKE $3 THEN 1
                 WHEN LOWER(name) LIKE $4 THEN 2
                 ELSE 3
               END,
               LENGTH(name) ASC
             LIMIT 1`,
            [
                `${searchName}%`,  // Starts with search name
                searchName,         // Exact match
                `${searchName}%`,   // Starts with search name (for "flour" -> "flour type 55")
                `%${searchName}%`   // Contains search name
            ]
        );
        
        // No match found - will be created
        return {
            ...ingredient,
            dbId: null,
            dbName: null,
            found: false,
            icon: '⚠️',
            matchType: 'none'
        };
        
    } catch (error) {
        console.error(`❌ Error matching ingredient "${ingredient.name}":`, error);
        
        // Return unmatched on error (don't fail the whole process)
        return {
            ...ingredient,
            dbId: null,
            dbName: null,
            found: false,
            icon: '⚠️',
            matchType: 'error'
        };
    }
};

// ________________________--------------Merge ingredients from multiple sources-------------__________
const mergeIngredients = (descriptionIngredients, minedIngredients) => {
    const merged = [...descriptionIngredients];
    
    const existingKeys = new Set(
        merged.map(ing => normalizeIngredientNameForMatching(ing.name))
    );

    for (const minedIng of minedIngredients) {
        const normKey = normalizeIngredientNameForMatching(minedIng.name);
        
        if (!existingKeys.has(normKey)) {
            merged.push({
                name: minedIng.name,
                quantity: minedIng.quantity,
                unit: minedIng.unit,
                section: minedIng.section || 'Main'
            });
            existingKeys.add(normKey);
        }
    }

    return merged;
};

// ________________________--------------Save Recipe from Video to Database-------------__________
// ________________________ Save Recipe from Video to Database ________________________
const saveRecipeFromVideo = async (req, res) => {
    const { generatedRecipe, conversionId, userId = null, videoThumbnail = null } = req.body;

    if (!generatedRecipe || !generatedRecipe.title) {
        return res.status(400).json({
            success: false,
            message: "Valid recipe data with title is required"
        });
    }

    const {
        title,
        steps,
        notes,
        prep_time,
        cook_time,
        difficulty,
        ingredients = [],
        course_type,
        meal_type,
        cuisine_type,
        servings,
        source
    } = generatedRecipe;

    if (!title || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Title and non-empty steps array are required"
        });
    }

    const total_time = (Number(prep_time) || 0) + (Number(cook_time) || 0) || null;
    let sourceUrl = source || 'video_conversion';

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Try to get source_url from conversion if available
        if (conversionId) {
            const conv = await client.query(
                `SELECT source_url FROM transcript_conversions WHERE id = $1`,
                [conversionId]
            );
            if (conv.rows.length > 0 && conv.rows[0].source_url) {
                sourceUrl = conv.rows[0].source_url;
            }
        }

        // 2. Insert recipe
        const recipeRes = await client.query(`
            INSERT INTO recipes (
                title, steps, notes, prep_time, cook_time, total_time, difficulty,
                course_type, meal_type, cuisine_type, public, source, portions, thumbnail_url
            )
            VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id, thumbnail_url
        `, [
            title,
            JSON.stringify(steps),
            notes || null,
            Number(prep_time) || null,
            Number(cook_time) || null,
            total_time,
            difficulty || 'Medium',
            course_type || 'Main Course',
            meal_type || 'Dinner',
            cuisine_type || 'Homemade',
            false,
            sourceUrl,
            servings || null,
            videoThumbnail || null
        ]);

        const recipeId = recipeRes.rows[0].id;
        const savedThumbnail = recipeRes.rows[0].thumbnail_url;

        // 3. Save ingredients (if any)
        let savedCount = 0;
        if (ingredients.length > 0) {
            for (const ing of ingredients) {
                if (!ing?.name?.trim()) continue;

                // Check if ingredient already exists (case-insensitive)
                let ingRes = await client.query(
                    `SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                    [ing.name]
                );

                let ingredientId;
                if (ingRes.rows.length > 0) {
                    ingredientId = ingRes.rows[0].id;
                } else {
                    const newIng = await client.query(
                        `INSERT INTO ingredients (name) VALUES ($1) RETURNING id`,
                        [ing.name]
                    );
                    ingredientId = newIng.rows[0].id;
                }

                const unit = normalizeUnit(ing.unit) || ing.unit || null;

                await client.query(`
                    INSERT INTO recipe_ingredients (
                        recipe_id, ingredient_id, quantity, unit, section
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    recipeId,
                    ingredientId,
                    ing.quantity ?? null,
                    unit,
                    ing.section || 'Main'
                ]);

                savedCount++;
            }
        }

        // 4. Update conversion status if applicable
        if (conversionId) {
            await client.query(`
                UPDATE transcript_conversions 
                SET recipe_status = 'saved', 
                    status = 'recipe_saved', 
                    updated_at = NOW()
                WHERE id = $1
            `, [conversionId]);
        }

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: "Recipe saved successfully",
            recipeId,
            conversionId,
            thumbnail: savedThumbnail || null,
            ingredientsSaved: savedCount
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error("Recipe save failed:", {
            title,
            conversionId,
            error: error.message,
            stack: error.stack?.slice(0, 300)
        });

        // Optional structured logging
        if (conversionId) {
            try {
                const { logConversionError } = require('../services/conversionLogger');
                await logConversionError(
                    conversionId,
                    'RecipeSaveError',
                    error.message,
                    'recipe_save'
                );
            } catch (logErr) {
                console.error("Failed to log conversion error:", logErr.message);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to save recipe",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });

    } finally {
        client.release();
    }
};

// ________________________--------------Normalize Ingredients-------------__________
const normalizeIngredients = (ingredients) => {
    const byKey = new Map();

    for (const ing of ingredients) {
        const key = normalizeIngredientNameForMatching(ing.name);
        if (key.length < 3) continue;

        if (byKey.has(key)) {
            const prev = byKey.get(key);
            if (ing.quantity && !prev.quantity) prev.quantity = ing.quantity;
            if (ing.unit && !prev.unit) prev.unit = ing.unit;
            if (ing.name < prev.name) prev.name = ing.name;
        } else {
            byKey.set(key, {
                name: ing.name,      
                quantity: ing.quantity,
                unit: ing.unit,
                section: ing.section || 'Main'
            });
        }
    }

    return Array.from(byKey.values());
};
// ________________________--------------Normalize unit to standard abbreviation-------------__________
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

// ________________________--------------Normalize ingredient name-----------------________________
// Common adjectives / modifiers that usually come before the main ingredient
const INGREDIENT_MODIFIERS = [
  'large', 'medium', 'small', 'extra large', 'jumbo',
  'fresh', 'dried', 'frozen', 'canned', 'jarred',
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'ground', 'crushed',
  'melted', 'softened', 'room temperature', 'cold', 'warm',
  'unsweetened', 'sweetened', 'semi sweet', 'bittersweet',
  'all purpose', 'all-purpose', 'whole wheat', 'whole grain', 'white', 'brown',
  'light', 'dark', 'extra virgin', 'virgin', 'pure',
  'organic', 'nonfat', 'low fat', 'fat free',
  'ground', 'powdered', 'whole', 'hulled',
  'smoked', 'cured', 'pickled', 'fermented',
];

// Core normalization for matching / deduplication / database lookup
const normalizeIngredientNameForMatching = (name) => {
    if (!name || typeof name !== 'string') return '';

    const cacheKey = name.trim().toLowerCase();
    if (nameNormalizationCache.has(cacheKey)) {
        return nameNormalizationCache.get(cacheKey);
    }

  let cleaned = name
    .toLowerCase()
    .trim()
    // Remove notes, alternatives, quantities that leaked in
    .replace(/\s*[\(\[][^)\]]+[\)\]]\s*/g, '')           // (notes)
    .replace(/\s*\[[^\]]+\]\s*/g, '')                     // [notes]
    .replace(/\s+or\s+.+$/gi, '')                         // or something else
    .replace(/\s*[–—−-].+$/gi, '')                        // – description
    .replace(/\s+to taste|optional|for garnish|for serving/gi, '')
    // Remove numbers (type 00, grade A, 2%, etc.)
    .replace(/\b\d+(?:\.\d+)?\s*(%|type|grade|proof)?\b/gi, '')
    // Remove common leading modifiers
    .replace(
      new RegExp(`\\b(${INGREDIENT_MODIFIERS.join('|')})\\b\\s+`, 'gi'),
      ''
    )
    // Rough singularization (basic)
    .replace(/ies$/, 'y')
    .replace(/(es|x|ch|sh|s)$/, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

    const result = cleaned.trim();
    nameNormalizationCache.set(cacheKey, result);
    return result;

  // ── Reorder: try to put the HEAD noun first ─────────────────────────────
  const words = cleaned.split(/\s+/);

  if (words.length <= 1) return cleaned;

  // Heuristic: look for known modifiers and move the word after them to front
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = words.slice(i, i + 2).join(' ');

    // Common patterns we want to reverse
    if (
      // oil-based
      phrase === 'olive oil' ||
      phrase === 'coconut oil' ||
      phrase === 'sesame oil' ||
      phrase === 'vegetable oil' ||
      phrase === 'canola oil' ||
      // vinegar-based
      phrase === 'white wine vinegar' ||
      phrase === 'red wine vinegar' ||
      phrase === 'apple cider vinegar' ||
      phrase === 'rice vinegar' ||
      // spice / flour / etc.
      phrase === 'ground cinnamon' ||
      phrase === 'ground ginger' ||
      phrase === 'all purpose flour' ||
      phrase === 'whole wheat flour' ||
      phrase.match(/^(white|brown|dark|light)\s+(sugar|chocolate)/)
    ) {
      // Move the second word (main) to front
      const main = words.splice(i + 1, 1)[0];
      words.unshift(main);
      cleaned = words.join(' ');
      break;
    }
  }

  // Final cleanup
  return cleaned.trim();
};

// Human-readable / display version (gentler cleaning, title case)
const cleanIngredientNameForDisplay = (name, options = { titleCase: true }) => {
  if (!name) return '';

  let cleaned = name
    .trim()
    .replace(/\s*[\(\[][^)\]]+[\)\]]\s*/g, '')
    .replace(/\s*[–—−-].+$/gi, '')
    .replace(/\s+or\s+.+$/gi, '')
    .replace(
      /\b(large|medium|small|fresh|dried|chopped|diced|minced|sliced|grated|ground|unsweetened|sweetened|all[ -]purpose|extra virgin)\b\s*/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (options.titleCase) {
    cleaned = cleaned.replace(/\w\S*/g, (txt) =>
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  return cleaned;
};

module.exports = {
    saveRecipeFromVideo,
    matchIngredientsWithDatabase,
    mergeIngredients,
    normalizeUnit,
    normalizeIngredients,
    cleanIngredientNameForDisplay,
    normalizeIngredientNameForMatching,
    VALID_UNITS
};