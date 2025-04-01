const express = require('express');
const router = express.Router();
const {
  rateRecipe,
  getRecipeRating,
  postComment,
  getComments,
  deleteComment,
  getUserRatings,
  getUserComments
} = require('../controllers/userInteractionController');
const authMiddleware = require('../middleware/authMiddleware');

// Get
router.get('/users/:userId/ratings', authMiddleware, getUserRatings);
router.get('/users/:userId/comments', authMiddleware, getUserComments);

// Ratings
router.post('/ratings/:recipeId', authMiddleware, rateRecipe);
router.get('/ratings/:recipeId', getRecipeRating);

// Comments
router.post('/comments/:recipeId', authMiddleware, postComment);
router.get('/comments/:recipeId', getComments);
router.delete('/comments/:commentId', authMiddleware, deleteComment);
router.get('/comments', authMiddleware, getUserComments);

module.exports = router;