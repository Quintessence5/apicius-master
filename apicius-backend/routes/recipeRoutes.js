const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const upload = multer({ dest: 'uploads/' });
const { getIngredientSuggestions, addRecipe, updateRecipe, getAllRecipes, getRecipeById } = require('../controllers/recipeController');

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

// Route to get all recipes with ingredients and additional fields
router.get('/', getAllRecipes);

// Route to get a single recipe by ID with ingredients
router.get('/:id', getRecipeById);

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