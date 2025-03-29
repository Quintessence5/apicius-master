const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const upload = multer({ dest: 'uploads/' });
const { getIngredientSuggestions, addRecipe, updateRecipe, 
    getAllRecipes, getRecipeById, deleteRecipe, 
    getDropdownOptions } = require('../controllers/recipeController');

router.use((req, res, next) => {
    console.log(`Recipe route accessed: ${req.method} ${req.url}`);
    next();
});

// Get Ingredient Suggestion
router.get('/ingredients', getIngredientSuggestions);

// Add new recipe and navigate to all recipes
router.post('/', upload.single('image'), addRecipe);

// Get Ingredient Suggestion
router.get('/options', getDropdownOptions);

// Update an existing recipe
router.put('/:id', upload.single('image'), updateRecipe);

// All recipes with ingredients and additional fields
router.get('/', getAllRecipes);

// Single recipe by ID with ingredients
router.get('/:id', getRecipeById);

// POST route for image upload
router.post('/upload-image', upload.single('image'), (req, res) => {
    try {
        const filePath = req.file.path; 
        res.status(200).json({ message: 'Image uploaded successfully', path: filePath });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ message: 'Failed to upload image' });
    }
});

router.delete('/:id', deleteRecipe);


module.exports = router;