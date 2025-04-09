const express = require('express');
const { getIngredientSuggestions } = require('../controllers/recipeController');
const ingredientController = require('../controllers/ingredientController'); 
const pool = require('../config/db'); 
const router = express.Router();
const { uploadExcel, uploadImage } = require('../config/multer');

// Route to get ingredients
router.get('/template', ingredientController.generateTemplate);

router.get('/all', ingredientController.getAllIngredients);
router.post('/', ingredientController.createIngredient);
router.get('/prices', ingredientController.getPrices);
router.get('/suggestions', getIngredientSuggestions);
router.get('/submissions', ingredientController.getSubmissions);
router.post('/upload', uploadExcel.single('file'), ingredientController.uploadIngredients);

router.put('/:id', ingredientController.updateIngredient);
router.post('/submissions/:id/approve', ingredientController.approveSubmission);
router.get('/:id', ingredientController.getIngredientById);
router.put('/prices/:ingredient_id', ingredientController.updatePrice);
router.delete('/:id', ingredientController.deleteIngredient);

router.post('/:id/image', uploadImage.single('image'), ingredientController.uploadImage );

module.exports = router;
