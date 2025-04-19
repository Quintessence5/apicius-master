const pool = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// __________-------------Add Recipe to Cart-------------__________
const addToCart = async (req, res) => {
  try {
    const { recipeId } = req.body;
    
    // Add recipe to cart_new
    await pool.query(`
      INSERT INTO cart_new (user_id, recipe_id)
      VALUES ($1, ARRAY[$2::INTEGER])
      ON CONFLICT (user_id) DO UPDATE
      SET recipe_id = cart_new.recipe_id || $2::INTEGER,
          updated_at = NOW()
    `, [req.userId, recipeId]);

    await pool.query(`
      INSERT INTO cart_ingredients (user_id, ingredient_id, recipe_id, converted_quantity, base_unit_id)
      SELECT 
        $1, 
        ri.ingredient_id, 
        $2, 
        ri.quantity * u.conversion_factor, 
        (SELECT id FROM units WHERE type = u.type ORDER BY conversion_factor ASC LIMIT 1)
      FROM recipe_ingredients ri
      JOIN units u ON u.abbreviation = ri.unit
      WHERE ri.recipe_id = $2
      ON CONFLICT (user_id, ingredient_id, recipe_id) DO NOTHING
    `, [req.userId, recipeId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Cart add error:', error);
    res.status(500).json({ message: 'Error updating cart' });
  }
};

// __________-------------Get Cart Contents-------------__________
const getCart = async (req, res) => {
    try {
      const cartResult = await pool.query(
        'SELECT recipe_id FROM cart_new WHERE user_id = $1',
        [req.userId]
      );
  
      if (!cartResult.rows[0]?.recipe_id?.length) {
        return res.json({ grouped: [], merged: [] });
      }
      const recipeIds = cartResult.rows[0].recipe_id;
  
      const groupedQuery = `
  SELECT 
    r.id AS recipe_id,
    r.title AS recipe_title,
    JSONB_AGG(JSONB_BUILD_OBJECT(
      'ingredient_id', ri.ingredient_id,
      'name', i.name,
      'quantity', ri.quantity,
      'unit', ri.unit,
      'acquired', COALESCE(ci.acquired, false)
    )) AS ingredients
  FROM unnest($1::INT[]) AS rid(recipe_id)
  JOIN recipes r ON r.id = rid.recipe_id
  JOIN recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN cart_ingredients ci 
    ON ci.user_id = $2 
    AND ci.recipe_id = r.id 
    AND ci.ingredient_id = ri.ingredient_id
    AND ci.deleted = false
  WHERE NOT EXISTS (
    SELECT 1 
    FROM cart_ingredients ci2 
    WHERE ci2.user_id = $2 
      AND ci2.recipe_id = r.id 
      AND ci2.ingredient_id = ri.ingredient_id 
      AND ci2.deleted = true
  )
  GROUP BY r.id, r.title
`;

const mergedQuery = `
      SELECT 
        ri.ingredient_id,
        i.name AS ingredient_name,
        SUM(CASE WHEN ci.acquired THEN 0 ELSE ri.quantity END) AS total_quantity,
        ri.unit,
        BOOL_AND(ci.acquired) AS acquired,
        BOOL_OR(ci.deleted) AS deleted
      FROM unnest($1::INT[]) AS rid(recipe_id)
      JOIN recipes r ON r.id = rid.recipe_id
      JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      JOIN ingredients i ON i.id = ri.ingredient_id
      LEFT JOIN cart_ingredients ci 
        ON ci.user_id = $2 
        AND ci.recipe_id = r.id 
        AND ci.ingredient_id = ri.ingredient_id
      WHERE COALESCE(ci.deleted, false) = false
      GROUP BY ri.ingredient_id, i.name, ri.unit
    `;

      const [grouped, merged] = await Promise.all([
        pool.query(groupedQuery, [recipeIds, req.userId]),
        pool.query(mergedQuery, [recipeIds, req.userId])
      ]);
  
      res.json({
        grouped: grouped.rows,
        merged: merged.rows
      });
  
    } catch (error) {
      console.error('Cart fetch error:', error.message);
      res.status(500).json({ 
        message: 'Error retrieving cart',
        details: error.message
      });
    }
  };

// __________-------------Remove Single Ingredient-------------__________
const deleteIngredient = async (req, res) => {
    try {
      const { id: ingredientId } = req.params;
      const { recipeId } = req.query;
  
      if (!ingredientId || isNaN(ingredientId)) {
        return res.status(400).json({ message: 'Invalid ingredient ID' });
      }
  
      await pool.query('BEGIN');
  
      // Soft delete implementation
      const query = `
        UPDATE cart_ingredients
        SET deleted = true
        WHERE user_id = $1 
          AND ingredient_id = $2
          ${recipeId ? 'AND recipe_id = $3' : ''}
      `;
  
      const params = [req.userId, ingredientId];
      if (recipeId) params.push(recipeId);
  
      await pool.query(query, params);
  
      // Update cart_new with active recipes
      await pool.query(`
        UPDATE cart_new
        SET recipe_id = ARRAY(
          SELECT DISTINCT ci.recipe_id
          FROM cart_ingredients ci
          WHERE ci.user_id = $1
            AND ci.deleted = false
          UNION
          SELECT unnest(recipe_id) 
          FROM cart_new 
          WHERE user_id = $1
        )
        WHERE user_id = $1
      `, [req.userId]);
  
      // Cleanup empty carts
      await pool.query(`
        DELETE FROM cart_new
        WHERE user_id = $1 AND cardinality(recipe_id) = 0
      `, [req.userId]);
  
      await pool.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Delete ingredient error:', error);
      res.status(500).json({ message: 'Error deleting ingredient' });
    }
  };

  
// __________-------------Remove Recipe-------------__________
    const restoreIngredient = async (req, res) => {
    try {
      const { ingredientId } = req.params;
      
      await pool.query(`
        UPDATE cart_ingredients
        SET deleted = false
        WHERE user_id = $1 
          AND ingredient_id = $2
      `, [req.userId, ingredientId]);
  
      res.json({ success: true });
    } catch (error) {
      console.error('Restore error:', error);
      res.status(500).json({ message: 'Error restoring ingredient' });
    }
  };

// __________-------------Remove Recipe-------------__________
const removeFromCart = async (req, res) => {
  try {
    const { recipeId } = req.body;
    
    await pool.query(`
      UPDATE cart_new
      SET recipe_id = ARRAY_REMOVE(recipe_id, $1)
      WHERE user_id = $2
    `, [recipeId, req.userId]);

    // Mark ingredients as deleted
    await pool.query(`
      UPDATE cart_ingredients
      SET deleted = true
      WHERE user_id = $1 AND recipe_id = $2
    `, [req.userId, recipeId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Cart remove error:', error);
    res.status(500).json({ message: 'Error removing item' });
  }
};

// __________-------------Clear Cart-------------__________
const clearCart = async (req, res) => {
    try {
      // Clear cart_new
      await pool.query(`
        DELETE FROM cart_new
        WHERE user_id = $1
      `, [req.userId]);
  
      // Clear cart_ingredients
      await pool.query(`
        DELETE FROM cart_ingredients
        WHERE user_id = $1
      `, [req.userId]);
  
      res.json({ success: true });
    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({ message: 'Error clearing cart' });
    }
  };

// __________-------------Toggle Acquired Status-------------__________
const toggleAcquired = async (req, res) => {
    try {
      const { ingredientId, recipeId, acquired } = req.body;
  
      if (!ingredientId || typeof acquired !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request parameters' });
      }
  
      const toggleAll = !recipeId;
  
      let query;
      const params = [acquired, req.userId, ingredientId];
      
      if (toggleAll) {
        query = `
          UPDATE cart_ingredients
          SET acquired = $1
          WHERE user_id = $2
            AND ingredient_id = $3
        `;
      } else {
        query = `
          UPDATE cart_ingredients
          SET acquired = $1
          WHERE user_id = $2
            AND ingredient_id = $3
            AND recipe_id = $4
        `;
        params.push(recipeId);
      }
  
      await pool.query(query, params);
      res.json({ success: true });
    } catch (error) {
      console.error('Toggle acquired error:', error);
      res.status(500).json({ message: 'Error updating status' });
    }
  };

module.exports = { restoreIngredient, addToCart, getCart, removeFromCart, clearCart, deleteIngredient, toggleAcquired };