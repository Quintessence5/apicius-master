const express = require('express');
const { getIngredientSuggestions } = require('../controllers/recipeController');
const { getAllIngredients, updateIngredient, deleteIngredient } = require('../controllers/ingredientController');
const ingredientController = require('../controllers/ingredientController'); 
const pool = require('../config/db'); 
const router = express.Router();
const upload = require('../config/multer');

// Route to get ingredients
router.get('/suggestions', getIngredientSuggestions);
router.get('/all', ingredientController.getAllIngredients);
router.get('/:id', ingredientController.getIngredientById);
router.post('/', ingredientController.createIngredient);
router.put('/:id', ingredientController.updateIngredient);
router.delete('/:id', ingredientController.deleteIngredient);

router.get('/submissions', ingredientController.getSubmissions);
router.post('/submissions/:id/approve', ingredientController.approveSubmission);
router.get('/prices', ingredientController.getPrices);
router.put('/prices/:id', ingredientController.updatePrice);
router.post('/upload', upload.single('file'), ingredientController.uploadIngredients);
router.get('/template', ingredientController.generateTemplate);
router.get('/', ingredientController.getAllIngredients);

module.exports = router;
