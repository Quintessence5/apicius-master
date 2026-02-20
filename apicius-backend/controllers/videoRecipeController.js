const pool = require('../config/db');
const {
    extractIngredientsFromText,
    analyzeDescriptionContent,
    generateRecipeWithLLM,
    normalizeUnit
} = require('../services/videoToRecipeService');
const { extractVideoId, detectPlatform } = require('../services/utils/videoUtils');
const { logConversion, logConversionError } = require('../services/conversionLogger');
// __________-------------Match ingredients with database-------------__________
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

// __________-------------Smart Ingredient Matching Function-------------__________
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
        console.log(`   🔍 Trying fuzzy match...`);
        
        const cleanedName = cleanIngredientForMatching(searchName);
        
        result = await pool.query(
            `SELECT id, name FROM ingredients 
             WHERE LOWER(name) LIKE $1 OR LOWER(name) LIKE $2
             ORDER BY LENGTH(name) ASC
             LIMIT 1`,
            [`%${cleanedName}%`, `${cleanedName}%`]
        );
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'fuzzy'
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
        
        if (result.rows.length > 0) {
            return {
                ...ingredient,
                dbId: result.rows[0].id,
                dbName: result.rows[0].name,
                found: true,
                icon: '✅',
                matchType: 'similar'
            };
        }
        
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

// __________-------------Clean ingredient name for fuzzy matching-------------__________
const cleanIngredientForMatching = (name) => {
    return name
        .toLowerCase()
        .trim()
        // Remove plurals
        .replace(/s$/, '')
        // Remove common descriptors
        .replace(/\s*(type|variety|kind|grade|quality|premium|standard|raw|fresh|dried|cooked|roasted|all|purpose|ground)\s*/gi, '')
        // Remove numbers and types (like "type 55")
        .replace(/\s*\d+\s*/g, '')
        // Remove extra spaces
        .replace(/\s+/g, ' ')
        .trim();
};

// __________-------------Merge ingredients from multiple sources-------------__________
const mergeIngredients = (descriptionIngredients, minedIngredients) => {
    const merged = [...descriptionIngredients];
    const existingNames = new Set(merged.map(ing => ing.name.toLowerCase().trim()));

    for (const minedIng of minedIngredients) {
        const normalizedName = minedIng.name.toLowerCase().trim();
        if (!existingNames.has(normalizedName)) {
            merged.push({
                name: minedIng.name,
                quantity: minedIng.quantity,
                unit: minedIng.unit,
                section: minedIng.section || 'Main'
            });
            existingNames.add(normalizedName);
        }
    }

    return merged;
};

// __________-------------Save Recipe from Video to Database-------------__________
const saveRecipeFromVideo = async (req, res) => {
    console.log("\n💾 ========== SAVING RECIPE TO DATABASE ==========");
    try {
        const { generatedRecipe, conversionId, userId = null, videoThumbnail = null } = req.body;
        console.log(`📸 Thumbnail received: ${videoThumbnail ? 'Yes ✅' : 'No ❌'}`);
        console.log(`📸 Thumbnail URL: ${videoThumbnail || 'null'}`);

        if (!generatedRecipe || !generatedRecipe.title) {
            return res.status(400).json({ success: false, message: "Valid recipe data is required" });
        }

        const {
            title,
            steps,
            notes,
            prep_time,
            cook_time,
            difficulty,
            ingredients,
            course_type,
            meal_type,
            cuisine_type,
            servings,
            source
        } = generatedRecipe;

        if (!title || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ success: false, message: "Title and steps are required" });
        }

        console.log(`📝 Saving recipe: "${title}"`);
        console.log(`   Ingredients: ${ingredients?.length || 0}`);
        console.log(`   Steps: ${steps.length}`);
        console.log(`   Thumbnail: ${videoThumbnail || 'None'}`);

        const total_time = (parseInt(prep_time) || 0) + (parseInt(cook_time) || 0) || null;

        // Fetch the source URL from the conversion record if available
        let sourceUrl = source || 'video_conversion';
        if (conversionId) {
            try {
                const conversionResult = await pool.query(
                    `SELECT source_url FROM transcript_conversions WHERE id = $1`,
                    [conversionId]
                );
                if (conversionResult.rows.length > 0 && conversionResult.rows[0].source_url) {
                    sourceUrl = conversionResult.rows[0].source_url;
                }
            } catch (err) {
                console.warn("Could not fetch source URL from conversion:", err.message);
            }
        }

        console.log(`🔍 Inserting recipe with thumbnail: ${videoThumbnail || 'null'}`);

        // Insert recipe WITH thumbnail URL
        const recipeResult = await pool.query(
            `INSERT INTO recipes (title, steps, notes, prep_time, cook_time, total_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source, portions, thumbnail_url)
            VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
            RETURNING id`,
            [
                title,
                JSON.stringify(steps),
                notes || null,
                parseInt(prep_time) || null,
                parseInt(cook_time) || null,
                total_time,
                difficulty || 'Medium',
                course_type || 'Main Course',
                meal_type || 'Dinner',
                cuisine_type || 'Homemade',
                false,
                sourceUrl,
                servings || null,
                videoThumbnail || null 
            ]
        );

        const recipeId = recipeResult.rows[0].id;
        const savedThumbnail = recipeResult.rows[0].thumbnail_url;
        
        console.log(`✅ Recipe inserted with ID: ${recipeId}`);
        console.log(`✅ Thumbnail saved: ${savedThumbnail || 'None'}`);

        let savedCount = 0;
        if (ingredients && ingredients.length > 0) {
            console.log(`🔗 Linking ${ingredients.length} ingredients...`);
            for (const ingredient of ingredients) {
                if (!ingredient.name || ingredient.name.trim().length === 0) continue;

                let ingredientId;
                const existingResult = await pool.query(
                    `SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1)`,
                    [ingredient.name]
                );

                if (existingResult.rows.length > 0) {
                    ingredientId = existingResult.rows[0].id;
                } else {
                    const newIngredientResult = await pool.query(
                        `INSERT INTO ingredients (name) VALUES ($1) RETURNING id`,
                        [ingredient.name]
                    );
                    ingredientId = newIngredientResult.rows[0].id;
                }

                if (ingredientId) {
                    const normalizedUnit = normalizeUnit(ingredient.unit) || ingredient.unit;
                    await pool.query(
                        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, section)
                        VALUES ($1, $2, $3, $4, $5)`,
                        [recipeId, ingredientId, ingredient.quantity || null, normalizedUnit, ingredient.section || 'Main']
                    );
                    savedCount++;
                }
            }
        }

        console.log(`✅ ${savedCount} ingredients linked`);

        // Update conversion status
        if (conversionId) {
            await pool.query(
                `UPDATE transcript_conversions SET recipe_status = $1, status = $2, updated_at = NOW() 
                 WHERE id = $3`,
                ['saved', 'recipe_saved', conversionId]
            );
        }

        res.json({
            success: true,
            message: "✅ Recipe saved successfully!",
            recipeId,
            conversionId
        });

    } catch (error) {
        console.error("❌ Error saving recipe:", error);
        
        if (req.body?.conversionId) {
            try {
                const { logConversionError } = require('../services/conversionLogger');
                await logConversionError(
                    req.body.conversionId,
                    'RecipeSaveError',
                    error.message,
                    'recipe_save'
                );
            } catch (logErr) {
                console.error("Could not log error:", logErr.message);
            }
        }

        res.status(500).json({
            success: false,
            message: "Error saving recipe",
            error: error.message
        });
    }
};

module.exports = {
    saveRecipeFromVideo,
    matchIngredientsWithDatabase,
    mergeIngredients
};