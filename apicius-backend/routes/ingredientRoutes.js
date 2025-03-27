const express = require('express');
const { getIngredientSuggestions } = require('../controllers/recipeController');
const { getAllIngredients, updateIngredient, deleteIngredient } = require('../controllers/ingredientController');
const ingredientController = require('../controllers/ingredientController'); 
const pool = require('../config/db'); 
const router = express.Router();
const upload = require('../config/multer');

// Route to get ingredients
router.get('/template', ingredientController.generateTemplate);

router.get('/all', ingredientController.getAllIngredients);
router.post('/', ingredientController.createIngredient);
router.get('/prices', ingredientController.getPrices);
router.get('/suggestions', getIngredientSuggestions);
router.get('/submissions', ingredientController.getSubmissions);
router.post('/upload', upload.single('file'), ingredientController.uploadIngredients);

router.put('/:id', ingredientController.updateIngredient);
router.post('/submissions/:id/approve', ingredientController.approveSubmission);
router.get('/:id', ingredientController.getIngredientById);
router.put('/prices/:ingredient_id', ingredientController.updatePrice);
router.delete('/:id', ingredientController.deleteIngredient);

module.exports = router;
