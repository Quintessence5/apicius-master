const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const pool = require('../config/db'); // Correctly import your DB connection

// Define CRUD routes
router.get('/', recipeController.getAllRecipes); // Get all recipes
router.get('/:id', recipeController.getRecipeById); // Get recipe by ID
router.post('/', recipeController.addRecipe); // Create new recipe
router.put('/:id', recipeController.updateRecipe); // Update recipe by ID
router.delete('/:id', recipeController.deleteRecipe); // Delete recipe by ID

// Fetch all ingredients
router.get('/ingredients', async (req, res) => {
    try {
        const ingredients = await pool.query('SELECT * FROM ingredients');
        res.json(ingredients.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


// Link ingredients to a recipe
router.post('/:id/ingredients', recipeController.addIngredientToRecipe); // Updated to use controller function

module.exports = router;
