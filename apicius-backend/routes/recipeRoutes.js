const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const upload = multer({ dest: 'uploads/' });
const { getIngredientSuggestions, addRecipe, updateRecipe } = require('../controllers/recipeController');

router.use((req, res, next) => {
    console.log(`Recipe route accessed: ${req.method} ${req.url}`);
    next();
});

// Get Ingredient Suggestion (React Select)
router.get('/ingredients', getIngredientSuggestions);

// Add new recipe and navigate to all recipes
router.post('/', upload.single('image'), addRecipe);

// Update an existing recipe
router.put('/:id', upload.single('image'), updateRecipe);

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

// POST route for image upload
router.post('/upload-image', upload.single('image'), (req, res) => {
    try {
        const filePath = req.file.path; // Path to the uploaded file
        res.status(200).json({ message: 'Image uploaded successfully', path: filePath });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ message: 'Failed to upload image' });
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