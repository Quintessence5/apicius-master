const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// __________-------------Get all recipes-------------__________
const getAllRecipes = async (req, res) => {
    try {
        // Extract query parameters
        const {
            search,
            meal_type,
            cuisine_type,
            course_type,
            diets,
            restrictions,
            allergies
        } = req.query;

        const dietFilters = diets ? diets.split(',') : [];
        const restrictionFilters = restrictions ? restrictions.split(',') : [];
        const allergyFilters = allergies ? allergies.split(',') : [];

        // Base query
        let query = `
            SELECT r.id AS recipe_id, r.title, r.notes, r.prep_time, r.cook_time, r.total_time, r.difficulty, 
                   r.course_type, r.meal_type, r.cuisine_type, r.source, r.steps, r.image_path, 
                   ri.quantity, ri.unit, ri.section, i.name AS ingredient_name, i.calories_per_100g, i.protein, 
                   i.lipids, i.carbohydrates, i.allergies
            FROM recipes r
            LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id
        `;

        const conditions = [];
        const values = [];

        if (search) {
            conditions.push(`(r.title ILIKE $${values.length + 1} OR i.name ILIKE $${values.length + 1})`);
            values.push(`%${search}%`);
        }

        if (meal_type) {
            conditions.push(`r.meal_type = $${values.length + 1}`);
            values.push(meal_type);
        }

        if (cuisine_type) {
            conditions.push(`r.cuisine_type = $${values.length + 1}`);
            values.push(cuisine_type);
        }

        if (course_type) {
            conditions.push(`r.course_type ILIKE $${values.length + 1}`);
            values.push(`%${course_type}%`);
        }

        if (dietFilters.length > 0) {
            conditions.push(`
                EXISTS (
                    SELECT 1 FROM recipe_ingredients ri
                    JOIN ingredients i ON ri.ingredient_id = i.id
                    JOIN food_control fc ON i.dietary_restrictions ILIKE '%' || fc.name || '%'
                    WHERE ri.recipe_id = r.id
                    AND fc.category IN ('Diet Medical', 'Diet Cultural', 'Diet Religious', 'Diet Popular')
                    AND fc.name = ANY($${values.length + 1}::text[])
                )
            `);
            values.push(dietFilters);
        }

        if (restrictionFilters.length > 0) {
            conditions.push(`
                NOT EXISTS (
                    SELECT 1 FROM recipe_ingredients ri
                    JOIN ingredients i ON ri.ingredient_id = i.id
                    JOIN food_control fc ON i.intolerance ILIKE '%' || fc.name || '%'
                    WHERE ri.recipe_id = r.id
                    AND fc.category = 'Intolerance'
                    AND fc.name = ANY($${values.length + 1}::text[])
                )
            `);
            values.push(restrictionFilters);
        }

        if (allergyFilters.length > 0) {
            conditions.push(`
                NOT EXISTS (
                    SELECT 1 FROM recipe_ingredients ri
                    JOIN ingredients i ON ri.ingredient_id = i.id
                    JOIN food_control fc ON i.allergies ILIKE '%' || fc.name || '%'
                    WHERE ri.recipe_id = r.id
                    AND fc.category = 'Allergy'
                    AND fc.name = ANY($${values.length + 1}::text[])
                )
            `);
            values.push(allergyFilters);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY r.id;`;

        // Execute the query
        const recipesResult = await pool.query(query, values);

        // Process the results 
        const recipes = recipesResult.rows.reduce((acc, row) => {
            const {
                recipe_id, title, notes, prep_time, cook_time, total_time, difficulty,
                course_type, meal_type, cuisine_type, source, steps, image_path,
                quantity, unit, ingredient_name, calories_per_100g, protein, lipids, carbohydrates, allergies
            } = row;

            // Check if recipe already exists
            let recipe = acc.find(r => r.recipe_id === recipe_id);
            if (!recipe) {
                recipe = {
                    recipe_id,
                    title,
                    notes,
                    prep_time,
                    cook_time,
                    total_time,
                    difficulty,
                    course_type,
                    meal_type,
                    cuisine_type,
                    source,
                    steps: Array.isArray(steps) ? steps : (typeof steps === 'string' ? steps.split(',') : []),
                    image_path,
                    total_nutrition: {
                        calories: 0,
                        protein: 0,
                        lipids: 0,
                        carbohydrates: 0,
                        allergies: new Set(),
                    },
                    ingredients: []
                };
                acc.push(recipe);
            }

            // Add ingredient to the recipe
            if (ingredient_name) {
                recipe.ingredients.push({ ingredient_name, quantity, unit, section: row.section || 'Main' });

                // Calculate nutrition for the ingredient
                const multiplier = parseFloat(quantity || 0) / 100; // Convert quantity to a fraction of 100g
                recipe.total_nutrition.calories += (calories_per_100g || 0) * multiplier;
                recipe.total_nutrition.protein += (protein || 0) * multiplier;
                recipe.total_nutrition.lipids += (lipids || 0) * multiplier;
                recipe.total_nutrition.carbohydrates += (carbohydrates || 0) * multiplier;

                // Add allergies
                if (allergies) {
                    allergies.split(',').forEach(allergy => recipe.total_nutrition.allergies.add(allergy.trim()));
                }
            }

            return acc;
        }, []);

        // Convert allergy sets to arrays
        recipes.forEach(recipe => {
            recipe.total_nutrition.allergies = Array.from(recipe.total_nutrition.allergies);
        });

        res.json(recipes);
    } catch (err) {
        console.error('Error fetching recipes:', err.message);
        res.status(500).send('Server error');
    }
};

// __________-------------Get Single Recipe-------------__________
const getRecipeById = async (req, res) => {
    const { id } = req.params;
    try {
        const recipeResult = await pool.query(`
            SELECT r.id, r.title, r.notes, r.prep_time, r.cook_time, r.total_time, r.difficulty, 
                   r.course_type, r.meal_type, r.cuisine_type, r.source, r.steps, r.image_path, r.portions, r.public,
                   r.thumbnail_url, ri.quantity, ri.unit, ri.section, 
                   i.id AS ingredient_id, i.name AS ingredient_name, i.calories_per_100g, 
                   i.protein, i.lipids, i.carbohydrates, i.saturated_fat, i.trans_fat, 
                   i.cholesterol, i.sodium, i.fibers, i.sugars, i.added_sugars, i.allergies, i.form
            FROM recipes r
            LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE r.id = $1;
        `, [id]);

        if (recipeResult.rows.length === 0) {
            console.log(`No recipe found with ID: ${id}`);
            return res.status(404).json({ message: 'Recipe not found' });
        }

        // Initialize Recipe Object
        const recipe = {
            id: recipeResult.rows[0].id,
            title: recipeResult.rows[0].title,
            notes: recipeResult.rows[0].notes,
            prep_time: recipeResult.rows[0].prep_time,
            cook_time: recipeResult.rows[0].cook_time,
            total_time: recipeResult.rows[0].total_time,
            portions: recipeResult.rows[0].portions,
            difficulty: recipeResult.rows[0].difficulty,
            course_type: recipeResult.rows[0].course_type,
            meal_type: recipeResult.rows[0].meal_type,
            cuisine_type: recipeResult.rows[0].cuisine_type,
            source: recipeResult.rows[0].source,
            steps: recipeResult.rows[0].steps,
            image_path: recipeResult.rows[0].image_path,
            thumbnail_url: recipeResult.rows[0].thumbnail_url,
            portions: recipeResult.rows[0].portions,
            public: recipeResult.rows[0].public,
            total_nutrition: {
                calories: 0, protein: 0, lipids: 0, carbohydrates: 0,
                saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 0,
                fibers: 0, sugars: 0, added_sugars: 0, allergies: new Set(),
            },
            ingredients: []
        };

        // Process Ingredients & Nutrition Data
        recipeResult.rows.forEach(row => {
    if (row.ingredient_name) {
        recipe.ingredients.push({
            ingredient_id: row.ingredient_id,
            ingredient_name: row.ingredient_name,
            quantity: row.quantity,
            unit: row.unit,
            form: row.form,
            section: row.section || 'Main'
        });

                // Calculate Nutrition Facts per Recipe
                const multiplier = parseFloat(row.quantity || 0) / 100; // Convert quantity to a fraction of 100g
                recipe.total_nutrition.calories += (row.calories_per_100g || 0) * multiplier;
                recipe.total_nutrition.protein += (row.protein || 0) * multiplier;
                recipe.total_nutrition.lipids += (row.lipids || 0) * multiplier;
                recipe.total_nutrition.carbohydrates += (row.carbohydrates || 0) * multiplier;
                recipe.total_nutrition.saturated_fat += (row.saturated_fat || 0) * multiplier;
                recipe.total_nutrition.trans_fat += (row.trans_fat || 0) * multiplier;
                recipe.total_nutrition.cholesterol += (row.cholesterol || 0) * multiplier;
                recipe.total_nutrition.sodium += (row.sodium || 0) * multiplier;
                recipe.total_nutrition.fibers += (row.fibers || 0) * multiplier;
                recipe.total_nutrition.sugars += (row.sugars || 0) * multiplier;
                recipe.total_nutrition.added_sugars += (row.added_sugars || 0) * multiplier;

                // Process Allergies
                if (row.allergies && row.allergies !== "none") {
                    row.allergies.split(',').forEach(allergy => recipe.total_nutrition.allergies.add(allergy.trim()));
                }
            }
        });

        // Convert allergy set to array
        recipe.total_nutrition.allergies = Array.from(recipe.total_nutrition.allergies);

        console.log("Recipe Data Sent to Frontend:", recipe); // Debugging log
        res.json(recipe);
    } catch (error) {
        console.error("Error fetching recipe:", error);
        res.status(500).json({ message: error.message });
    }
};

// __________-------------Add a new Recipe-------------__________
const addRecipe = async (req, res) => {
    console.log("DEBUG: addRecipe function is running...");
    try {
        const uploadedFile = req.file;
        const imagePath = uploadedFile ? uploadedFile.path : null;

        console.log("Incoming request body:", req.body);

        const { title, steps, notes, prep_time, cook_time, difficulty, ingredients, course_type, meal_type, cuisine_type, public, source, portions } = req.body;

        if (!title || !Array.isArray(steps) || steps.some(step => typeof step !== "string")) {
            return res.status(400).json({ message: "Invalid recipe data. Title and steps are required." });
        }

        const total_time = parseInt(prep_time) + parseInt(cook_time);

        const recipeResult = await pool.query(
            `INSERT INTO recipes (title, steps, notes, prep_time, cook_time, total_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source, portions, image_path)
            VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
            [title, JSON.stringify(steps), notes, prep_time, cook_time, total_time, difficulty, course_type, meal_type, cuisine_type, public, source, portions, imagePath]
        );

        const recipeId = recipeResult.rows[0].id;

        if (uploadedFile) {
            const newFileName = `${recipeId}-${title.replace(/\s+/g, '_')}${path.extname(uploadedFile.originalname)}`;
            const newPath = path.join(__dirname, '..', 'uploads', newFileName);

            fs.rename(uploadedFile.path, newPath, (err) => {
                if (err) {
                    console.error("Error renaming file:", err);
                    return res.status(500).json({ message: "Error renaming file" });
                }
                console.log("File renamed successfully to:", newFileName);

                pool.query(`UPDATE recipes SET image_path = $1 WHERE id = $2`, [newPath, recipeId])
                    .catch(error => console.error("Error updating image_path:", error));
            });
        }

        if (ingredients && ingredients.length > 0) {
            for (const ingredient of ingredients) {
                if (!ingredient.ingredientId && !ingredient.name) continue;

                let ingredientId;

                if (ingredient.ingredientId) {
                    ingredientId = ingredient.ingredientId;
                } else {
                    const ingredientResult = await pool.query(
                        `INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
                        [ingredient.name]
                    );

                    ingredientId = ingredientResult.rows[0]?.id;

                    if (!ingredientId) {
                        const existingIngredient = await pool.query(
                            `SELECT id FROM ingredients WHERE name = $1`,
                            [ingredient.name]
                        );
                        ingredientId = existingIngredient.rows[0]?.id;
                    }
                }

                if (ingredientId) {
                    await pool.query(
                        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                        VALUES ($1, $2, $3, $4)`,
                        [recipeId, ingredientId, ingredient.quantity || null, ingredient.unit || null]
                    );
                }
            }
        }

        res.status(201).json({ message: "Recipe added successfully!" });
    } catch (error) {
        console.error("Error in addRecipe:", error);
        res.status(500).json({ message: "Error adding recipe" });
    }
};

// __________-------------Update Recipe-------------__________
const updateRecipe = async (req, res) => {
    console.log("DEBUG: updateRecipe function is running...");
    try {
        const { id } = req.params;
        const uploadedFile = req.file;
        const imagePath = uploadedFile ? uploadedFile.path : null;

        console.log(`Updating recipe ID: ${id}`);
        console.log("Incoming request body:", req.body);

        let { 
            title, steps, notes, prep_time, cook_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source, portions, ingredients, deletedIngredients 
        } = req.body;

        // Parse deletedIngredients as a JSON array
        if (typeof deletedIngredients === "string") {
            deletedIngredients = JSON.parse(deletedIngredients);
        }

        const total_time = parseInt(prep_time) + parseInt(cook_time);

        // --- Update the recipe details ---
        let updateQuery = `
            UPDATE recipes 
            SET title = \$1, steps = \$2::jsonb, notes = \$3, prep_time = \$4, cook_time = \$5, total_time = \$6, difficulty = \$7, 
                course_type = \$8, meal_type = \$9, cuisine_type = \$10, public = \$11, source = \$12, portions = \$13
        `;

        const queryValues = [
            title, JSON.stringify(steps), notes, prep_time, cook_time, total_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source, portions
        ];

        if (imagePath) {
            updateQuery += `, image_path = $14`;
            queryValues.push(imagePath);
        }

        updateQuery += ` WHERE id = $${queryValues.length + 1} RETURNING *;`;
        queryValues.push(id);

        const updatedRecipe = await pool.query(updateQuery, queryValues);

        if (updatedRecipe.rows.length === 0) {
            console.error("ERROR: Recipe not found!");
            return res.status(404).json({ message: "Recipe not found" });
        }

        console.log("✅ Recipe details updated successfully!");

        if (uploadedFile) {
            const newFileName = `${id}-${title.replace(/\s+/g, '_')}${path.extname(uploadedFile.originalname)}`;
            const newPath = path.join(__dirname, '..', 'uploads', newFileName);

            fs.rename(uploadedFile.path, newPath, async (err) => {
                if (err) {
                    console.error("Error renaming file:", err);
                    return res.status(500).json({ message: "Error renaming file" });
                }

                console.log(`✅ File renamed successfully to: ${newFileName}`);

                await pool.query(`UPDATE recipes SET image_path = $1 WHERE id = $2`, [newPath, id]);
            });
        }

        // --- Handling Ingredients ---
                console.log("Processing ingredients...");

if (typeof ingredients === "object" && !Array.isArray(ingredients)) {
    ingredients = Object.values(ingredients).filter(ing => ing.ingredientId || ing.name);
}

if (Array.isArray(ingredients) && ingredients.length > 0) {
    console.log(`🔄 Updating ${ingredients.length} ingredients...`);

    for (const ingredient of ingredients) {
        if (!ingredient.ingredientId && !ingredient.name) continue;

        let ingredientId = ingredient.ingredientId;

        // Insert ingredient if it doesn't exist
        if (!ingredientId) {
            const ingredientResult = await pool.query(
                `INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
                [ingredient.name]
            );

            ingredientId = ingredientResult.rows[0]?.id;

            if (!ingredientId) {
                const existing = await pool.query(
                    `SELECT id FROM ingredients WHERE name = $1`,
                    [ingredient.name]
                );
                ingredientId = existing.rows[0]?.id;
            }
        }

        if (ingredientId) {
            const section = ingredient.section || 'Main';

            const existing = await pool.query(
                `SELECT * FROM recipe_ingredients WHERE recipe_id = $1 AND ingredient_id = $2`,
                [id, ingredientId]
            );

            if (existing.rows.length > 0) {
                // Update existing
                await pool.query(
                    `UPDATE recipe_ingredients 
                     SET quantity = $1, unit = $2, section = $3 
                     WHERE recipe_id = $4 AND ingredient_id = $5`,
                    [ingredient.quantity || null, ingredient.unit || null, section, id, ingredientId]
                );
                console.log(`✅ Updated ingredient: ${ingredient.name || ingredientId} (section: ${section})`);
            } else {
                // Insert new
                await pool.query(
                    `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, section)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [id, ingredientId, ingredient.quantity || null, ingredient.unit || null, section]
                );
                console.log(`✅ Added ingredient: ${ingredient.name || ingredientId} (section: ${section})`);
            }
        }
    }
} else {
    console.log("⚠️ No valid ingredients provided. Keeping existing ones.");
}

        // --- Handling Deleted Ingredients ---
        if (deletedIngredients && deletedIngredients.length > 0) {
            console.log(`🔄 Deleting ${deletedIngredients.length} ingredients...`);

            for (const ingredientId of deletedIngredients) {
                await pool.query(
                    `DELETE FROM recipe_ingredients WHERE recipe_id = $1 AND ingredient_id = $2`,
                    [id, ingredientId]
                );
                console.log(`✅ Deleted ingredient: ${ingredientId}`);
            }
        }

        res.json({ message: "Recipe updated successfully!", updatedRecipe: updatedRecipe.rows[0] });

    } catch (error) {
        console.error("❌ Error in updateRecipe:", error);
        res.status(500).json({ message: "Error updating recipe" });
    }
};

// __________-------------Delete Full Recipe-------------__________
const deleteRecipe = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);

        const deleteResult = await pool.query('DELETE FROM recipes WHERE id = $1 RETURNING *', [id]);

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        res.status(200).json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// __________-------------Get All Ingredients-------------__________
const getAllIngredients = async (req, res) => {
    try {
        const ingredients = await pool.query('SELECT * FROM ingredients');
        res.json(ingredients.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// __________-------------Add Ingredient Recipe-------------__________
const addIngredientToRecipe = async (req, res) => {
    const recipeId = req.params.id;
    const { ingredientId, quantity, unit } = req.body;

    try {
        await pool.query(
            `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) 
            VALUES ($1, $2, $3, $4)`,
            [recipeId, ingredientId, quantity, unit]
        );
        res.status(201).send('Ingredient added to recipe');
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server error');
    }
};

// __________-------------Get Ingredient Suggestion-------------__________
const getIngredientSuggestions = async (req, res) => {
    try {
        const { search } = req.query;

        if (!search || search.trim().length < 0) {
            return res.status(400).json({ message: "Search query must be at least 2 characters." });
        }

        const query = `
            SELECT id, name, form 
            FROM ingredients 
            WHERE name ILIKE $1 
            ORDER BY name ASC 
            LIMIT 10;
        `;
        const values = [`%${search.trim()}%`];
        const results = await pool.query(query, values);

        res.json(results.rows);
    } catch (error) {
        console.error("Error fetching ingredient suggestions:", error);
        res.status(500).json({ message: "Server error" });
    }
}; 

const getDropdownOptions = async (req, res) => {
    try {
        // Fetch meal types
        const mealTypesQuery = "SELECT name FROM meal_types WHERE category ILIKE 'meal_type';";
        const mealTypes = await pool.query(mealTypesQuery);
        
        // Fetch cuisine types
        const cuisineTypesQuery = "SELECT name FROM meal_types WHERE category ILIKE 'cuisine_type';";
        const cuisineTypes = await pool.query(cuisineTypesQuery);
        
        // Fetch course types
        const courseTypesQuery = "SELECT name FROM meal_types WHERE category ILIKE 'course_type';";
        const courseTypes = await pool.query(courseTypesQuery);
        
        // Fetch dietary restrictions
        const dietaryRestrictionsQuery = `
            SELECT name, 
            CASE
                WHEN category IN ('Allergy') THEN 'Allergy'
                WHEN category LIKE 'Diet%' THEN 'Diet'
                ELSE 'Restriction'
            END as category
            FROM food_control;
        `;
        const dietaryRestrictions = await pool.query(dietaryRestrictionsQuery);
        
        // Combine all grouped data into a single response
        const responseData = {
            mealTypes: mealTypes.rows,
            cuisineTypes: cuisineTypes.rows,
            courseTypes: courseTypes.rows,
            dietaryRestrictions: dietaryRestrictions.rows,
        };

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching dropdown options:', error);
        res.status(500).send('Server error');
    }
};

// __________-------------Export-------------__________
module.exports = {
    getAllRecipes,
    getRecipeById,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    getAllIngredients,
    getIngredientSuggestions,
    addIngredientToRecipe,
    getDropdownOptions,
};
