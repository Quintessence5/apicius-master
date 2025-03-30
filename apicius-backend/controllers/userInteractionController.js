const pool = require('../config/db');

const rateRecipe = async (req, res) => {
  const { recipeId } = req.params;
  const { rating } = req.body;
  const userId = req.userId;

  try {
    const result = await pool.query(
      `INSERT INTO ratings (user_id, recipe_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, recipe_id)
       DO UPDATE SET rating = $3
       RETURNING *`,
      [userId, recipeId, rating]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
};

const getRecipeRating = async (req, res) => {
    const { recipeId } = req.params;
  
    try {
      const result = await pool.query(
        `SELECT 
          COALESCE(AVG(rating), 0)::FLOAT as average, 
          COUNT(*)::INT as total
         FROM ratings
         WHERE recipe_id = $1`,
        [recipeId]
      );
      res.status(200).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch rating' });
    }
  };

// Comment Functions
const postComment = async (req, res) => {
  const { recipeId } = req.params;
  const { comment } = req.body;
  const userId = req.userId;

  try {
    const result = await pool.query(
      `INSERT INTO comments (user_id, recipe_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, recipeId, comment]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
};

const getComments = async (req, res) => {
    const { recipeId } = req.params;
  
    try {
      const result = await pool.query(
        `SELECT c.*, up.username, u.profile_picture
         FROM comments c
         JOIN users u ON c.user_id = u.id
         LEFT JOIN user_profile up ON u.id = up.user_id
         WHERE recipe_id = $1
         ORDER BY created_at DESC`,
        [recipeId]
      );
      res.status(200).json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  };
  
const deleteComment = async (req, res) => {
    const { commentId } = req.params;
    const userId = req.userId; 
    const userRole = req.userRole; 
  
    try {
      // Check if comment exists
      const commentResult = await pool.query(
        `SELECT * FROM comments WHERE id = $1`,
        [commentId]
      );
      if (commentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
  
      const comment = commentResult.rows[0];
  
      if (comment.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Not owner or admin' });
      }
      
      await pool.query(`DELETE FROM comments WHERE id = $1`, [commentId]);
      res.status(200).json({ message: 'Comment deleted' });
    } catch (err) {
      console.error('Error deleting comment:', err);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  };

module.exports = {
  rateRecipe,
  getRecipeRating,
  postComment,
  getComments,
  deleteComment
};