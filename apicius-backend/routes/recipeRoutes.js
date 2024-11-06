const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Import database connection

// Get all recipes with ingredients and quantities
router.get('/', async (req, res) => {
    try {
        const recipesResult = await pool.query(`
            SELECT r.id, r.title, r.description, r.notes, r.prep_time, r.cook_time, r.total_time, r.difficulty,
                   ri.ingredient_id, ri.quantity, ri.unit, i.name AS ingredient_name
            FROM recipes r
            LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
            LEFT JOIN ingredients i ON ri.ingredient_id = i.id
            ORDER BY r.id;
        `);

        // Group recipes by ID to include ingredients
        const recipes = recipesResult.rows.reduce((acc, row) => {
            const {
                id, title, description, notes, prep_time, cook_time, total_time, difficulty,
                ingredient_id, quantity, unit, ingredient_name
            } = row;

            // Check if the recipe ID already exists
            let recipe = acc.find(r => r.id === id);
            if (!recipe) {
                // If not, add it with basic info
                recipe = {
                    id, title, description, notes, prep_time, cook_time, total_time, difficulty,
                    ingredients: []
                };
                acc.push(recipe);
            }

            // Add ingredient details if available
            if (ingredient_id) {
                recipe.ingredients.push({
                    ingredient_id, ingredient_name, quantity, unit
                });
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
            SELECT r.id, r.title, r.description, r.notes, r.prep_time, r.cook_time, r.total_time, r.difficulty,
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

// Add new recipe and navigate to all recipes
router.post('/', async (req, res) => {
    try {
        const { title, description, notes, prep_time, cook_time, total_time, difficulty, ingredients } = req.body;

        // Insert the recipe into the recipes table
        const newRecipe = await pool.query(`
            INSERT INTO recipes (title, description, notes, prep_time, cook_time, total_time, difficulty)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;
        `, [title, description, notes, prep_time, cook_time, total_time, difficulty]);

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
    const { title, description, notes, prep_time, cook_time, total_time, difficulty } = req.body;
    
    try {
        const updateRecipe = await pool.query(`
            UPDATE recipes SET title = $1, description = $2, notes = $3, prep_time = $4, cook_time = $5, total_time = $6, difficulty = $7
            WHERE id = $8 RETURNING *;
        `, [title, description, notes, prep_time, cook_time, total_time, difficulty, id]);

        if (updateRecipe.rows.length === 0) {
            return res.status(404).json({ msg: 'Recipe not found' });
        }

        res.json(updateRecipe.rows[0]);
    } catch (err) {
        console.error(err.message);
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
