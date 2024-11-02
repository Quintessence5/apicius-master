const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');

router.post('/add', recipeController.addRecipe);
router.get('/', recipeController.getAllRecipes);

module.exports = router;
