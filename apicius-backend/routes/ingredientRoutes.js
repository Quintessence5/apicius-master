const express = require('express');
const { getIngredientSuggestions } = require('../controllers/recipeController');
const { getAllIngredients } = require('../controllers/recipeController'); 
const pool = require('../config/db'); 
const router = express.Router();

// Route to get ingredients
router.get('/', getIngredientSuggestions);
router.get('/', getAllIngredients);

module.exports = router;
