const express = require('express');
const { getIngredientSuggestions } = require('../controllers/recipeController');
const { getAllIngredients } = require('../controllers/ingredientController'); 
const pool = require('../config/db'); 
const router = express.Router();

// Route to get ingredients
router.get('/suggestions', getIngredientSuggestions);
router.get('/all', getAllIngredients);

module.exports = router;
