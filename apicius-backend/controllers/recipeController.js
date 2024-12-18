const pool = require('../config/db'); // Ensure this is correctly pointing to your database configuration

// 1. Get all recipes
const getAllRecipes = async (req, res) => {
    try {
        const query = `
            SELECT 
                r.id AS recipe_id, 
                r.title, 
                r.description, 
                r.notes, 
                r.prep_time, 
                r.cook_time, 
                r.total_time, 
                r.difficulty, 
                r.course_type, 
                r.meal_type, 
                r.cuisine_type, 
                r.source,
                ri.quantity, 
                ri.unit, 
                i.name AS ingredient_name
            FROM 
                recipes r
            LEFT JOIN 
                recipe_ingredients ri ON r.id = ri.recipe_id
            LEFT JOIN 
                ingredients i ON ri.ingredient_id = i.id
            WHERE 
                r.public = true -- Ensure filtering for public recipes
            ORDER BY 
                r.id;
        `;

        const results = await pool.query(query);

        // Log the results to confirm filtering works
        console.log("Filtered recipes:", results.rows);

        // Group and process the recipes
        const recipes = results.rows.reduce((acc, row) => {
            const {
                recipe_id,
                title,
                description,
                notes,
                prep_time,
                cook_time,
                total_time,
                difficulty,
                course_type,
                meal_type,
                cuisine_type,
                source,
                quantity,
                unit,
                ingredient_name,
            } = row;

            if (!acc[recipe_id]) {
                acc[recipe_id] = {
                    id: recipe_id,
                    title,
                    description,
                    notes,
                    prep_time,
                    cook_time,
                    total_time,
                    difficulty,
                    course_type: course_type || null,
                    meal_type: meal_type || null,
                    cuisine_type: cuisine_type || null,
                    source: source || null,
                    ingredients: [],
                };
            }

            if (ingredient_name) {
                acc[recipe_id].ingredients.push({
                    quantity,
                    unit,
                    ingredient_name,
                });
            }

            return acc;
        }, {});

        res.json(Object.values(recipes));
    } catch (error) {
        console.error("Error fetching recipes:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// 2. Get a single recipe by ID
const getRecipeById = async (req, res) => {
    const { id } = req.params;
    try {
        const recipe = await pool.query('SELECT * FROM recipes WHERE id = $1', [id]);
        if (recipe.rows.length === 0) return res.status(404).json({ message: 'Recipe not found' });
        
        res.json(recipe.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Add a new recipe
const addRecipe = async (req, res) => {
    const { title, description, notes, prep_time, cook_time, difficulty, ingredients, course_type, meal_type, cuisine_type, public, source 
    } = req.body;

    console.log("Recipe data received:", {
        title, description, notes, prep_time, cook_time, difficulty, course_type, meal_type, cuisine_type, public, source
    });
    
    try {
        // Calculate total_time before insertion
        const total_time = prep_time + cook_time;

        // Insert into recipes table
        const recipeResult = await pool.query(
            `INSERT INTO recipes (title, description, notes, prep_time, cook_time, total_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [title, description, notes, prep_time, cook_time, total_time, difficulty, course_type, meal_type, cuisine_type, public, source,]
        );

        const recipeId = recipeResult.rows[0].id;

        // Insert ingredients into recipe_ingredients table
        for (const ingredient of ingredients) {
            const ingredientResult = await pool.query(
                `INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
                [ingredient.name]
            );
            let ingredientId = ingredientResult.rows[0]?.id; // Use optional chaining

            // Check if ingredient was inserted or exists
            if (!ingredientId) {
                const existingIngredient = await pool.query('SELECT id FROM ingredients WHERE name = $1', [ingredient.name]);
                if (existingIngredient.rows.length > 0) {
                    ingredientId = existingIngredient.rows[0].id;
                }
            }

            await pool.query(
                `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                VALUES ($1, $2, $3, $4)`,
                [recipeId, ingredientId, ingredient.quantity, ingredient.unit]
            );
        }

        res.status(201).json({ message: 'Recipe added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding recipe' });
    }
};

// 4. Update a recipe by ID
const updateRecipe = async (req, res) => {
    const { id } = req.params;
    const { title, description, notes, prep_time, cook_time, difficulty, course_type, meal_type, cuisine_type, public, source, } = req.body;

    try {
        const total_time = prep_time + cook_time; // Calculate total time

        const updatedRecipe = await pool.query(
            `UPDATE recipes 
            SET title = $1, description = $2, notes = $3, prep_time = $4, cook_time = $5, total_time = $6, difficulty = $7, course_type = $8, meal_type = $9, 
                cuisine_type = $10, public = $11, source = $12 
            WHERE id = $8 RETURNING *`,
            [title, description, notes, prep_time, cook_time, total_time, difficulty, course_type, meal_type, cuisine_type, public, source, id,]
        );

        if (updatedRecipe.rows.length === 0) return res.status(404).json({ message: 'Recipe not found' });
        res.json(updatedRecipe.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 5. Delete a recipe by ID
const deleteRecipe = async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await pool.query('DELETE FROM recipes WHERE id = $1', [id]);
        if (deleteResult.rowCount === 0) return res.status(404).json({ message: 'Recipe not found' });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 6. Get all ingredients
const getAllIngredients = async (req, res) => {
    try {
        const ingredients = await pool.query('SELECT * FROM ingredients');
        res.json(ingredients.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 7. Add ingredient to a recipe
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

const getIngredientSuggestions = async (req, res) => {
    try {
        const { search } = req.query; // Get the search query from the request

        // If no search term is provided, return no options
        if (!search) {
            return res.status(400).json({ message: "No search term provided" });
        }

        // Use the search term in the SQL query with ILIKE for case-insensitive matching
        const query = `
            SELECT id, name
            FROM ingredients
            WHERE name ILIKE $1
            LIMIT 10;
        `;

        const results = await pool.query(query, [`%${search}%`]);

        // If no results found, return a message
        if (results.rows.length === 0) {
            return res.json({ message: "No options" });
        }

        // Return the matching ingredients
        res.json(results.rows);
    } catch (error) {
        console.error("Error fetching ingredient suggestions:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getAllRecipes,
    getRecipeById,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    getAllIngredients,
    getIngredientSuggestions,
    addIngredientToRecipe,
};
