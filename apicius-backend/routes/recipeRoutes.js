const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getIngredientSuggestions } = require('../controllers/recipeController');

// Get all recipes with ingredients and quantities
router.get('/', async (req, res) => {
    try {
        const recipesResult = await pool.query(`
            SELECT r.id, r.title, r.description, r.notes, r.prep_time, r.cook_time, r.total_time, r.difficulty, r.course_type, r.meal_type, r.cuisine_type, r.public, r.source,
                   ri.ingredient_id, ri.quantity, ri.unit, i.name AS ingredient_name
            FROM recipes r
            LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id
            ORDER BY r.id;
        `);

        // Group recipes by ID to include ingredients
        const recipes = recipesResult.rows.reduce((acc, row) => {
            const {
                id, title, description, notes, prep_time, cook_time, total_time, difficulty, course_type, meal_type, cuisine_type, public, source,
                ingredient_id, quantity, unit, ingredient_name
            } = row;

            // Check if the recipe ID already exists
            let recipe = acc.find(r => r.id === id);
            if (!recipe) {
                // If not, add it with basic info
                recipe = {
                    id, title, description, notes, prep_time, cook_time, total_time, difficulty, course_type, meal_type, cuisine_type, public, source,
                    ingredients: []
                };
                acc.push(recipe);
            }

            // Add ingredient details if available
            if (ingredient_id) {
                recipe.ingredients.push({ingredient_id, ingredient_name, quantity, unit});
            }

            return acc;
        }, []);

        res.json(recipes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get single recipe by ID with ingredients
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const recipeResult = await pool.query(`
            SELECT r.id, r.title, r.description, r.notes, r.prep_time, r.cook_time, r.total_time, r.difficulty, r.course_type, r.meal_type, r.cuisine_type, r.public, r.source,
                   ri.ingredient_id, ri.quantity, ri.unit, i.name AS ingredient_name
            FROM recipes r
            LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE r.id = $1;
        `, [id]);

        if (recipeResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Recipe not found' });
        }

        // Extract recipe details
        const {
            title, description, notes, prep_time, cook_time, total_time, difficulty
        } = recipeResult.rows[0];

        const recipe = {
            id,
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
            public,
            source,
            ingredients: recipeResult.rows.map(row => ({
                ingredient_id: row.ingredient_id,
                ingredient_name: row.ingredient_name,
                quantity: row.quantity,
                unit: row.unit
            }))
        };

        res.json(recipe);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.get('/ingredients', getIngredientSuggestions);


// Add new recipe and navigate to all recipes
router.post('/', async (req, res) => {
    try {
        const { title, description, notes, prep_time, cook_time, total_time, difficulty, ingredients, course_type, meal_type, cuisine_type, public, source } = req.body;

        // Insert the recipe into the recipes table
        const newRecipe = await pool.query(`
            INSERT INTO recipes (title, description, notes, prep_time, cook_time, total_time, difficulty,course_type, meal_type, cuisine_type, public, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id;
        `, [title, description, notes, prep_time, cook_time, total_time, difficulty,course_type, meal_type, cuisine_type, public, source]);

        const recipeId = newRecipe.rows[0].id;

        // Insert each ingredient for the recipe
        if (ingredients && ingredients.length > 0) {
            const ingredientPromises = ingredients.map(({ ingredientId, quantity, unit }) =>
                pool.query(`
                    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                    VALUES ($1, $2, $3, $4);
                `, [recipeId, ingredientId, quantity, unit])
            );
            await Promise.all(ingredientPromises);
        }

        // Redirect to the all recipes page
        res.status(201).json({ msg: 'Recipe added successfully!', redirectTo: '/all-recipes' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Update an existing recipe
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, notes, prep_time, cook_time, total_time, difficulty, course_type, meal_type, cuisine_type, public, source, ingredients } = req.body;
    
    try {
        const updateRecipe = await pool.query(`
            UPDATE recipes SET title = $1, description = $2, notes = $3, prep_time = $4, cook_time = $5, total_time = $6, difficulty = $7, course_type = $8, meal_type = $9, cuisine_type = $10, public = $11, source = $12
            WHERE id = $13 RETURNING *;
        `, [title, description, notes, prep_time, cook_time, total_time, difficulty, course_type, meal_type, cuisine_type, public, source, id]);

        if (updateRecipe.rows.length === 0) {
            return res.status(404).json({ msg: 'Recipe not found' });
        }

        // Delete existing ingredients for this recipe
        await pool.query(`
            DELETE FROM recipe_ingredients WHERE recipe_id = $1;
        `, [id]);

        // Add updated ingredients
        if (ingredients && ingredients.length > 0) {
            const ingredientPromises = ingredients.map(({ ingredientId, quantity, unit }) =>
                pool.query(`
                    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                    VALUES ($1, $2, $3, $4);
                `, [id, ingredientId, quantity, unit])
            );
            await Promise.all(ingredientPromises);
        }

        res.json({ msg: 'Recipe and ingredients updated successfully!', updatedRecipe: updateRecipe.rows[0] });
    } catch (err) {
        console.error("Error in PUT /:id:", err);
        res.status(500).send('Server error');
    }
});

// Delete an existing recipe
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const deleteRecipe = await pool.query('DELETE FROM recipes WHERE id = $1 RETURNING *;', [id]);

        if (deleteRecipe.rows.length === 0) {
            return res.status(404).json({ msg: 'Recipe not found' });
        }

        res.json({ msg: 'Recipe deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
