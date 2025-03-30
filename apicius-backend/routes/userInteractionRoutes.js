const express = require('express');
const router = express.Router();
const {
  rateRecipe,
  getRecipeRating,
  postComment,
  getComments,
  deleteComment
} = require('../controllers/userInteractionController');
const authMiddleware = require('../middleware/authMiddleware');

// Ratings
router.post('/ratings/:recipeId', authMiddleware, rateRecipe);
router.get('/ratings/:recipeId', getRecipeRating);

// Comments
router.post('/comments/:recipeId', authMiddleware, postComment);
router.get('/comments/:recipeId', getComments);
router.delete('/comments/:commentId', authMiddleware, deleteComment);

module.exports = router;