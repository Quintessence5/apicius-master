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
      const showDeleted = req.query.showDeleted === 'true';
    
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
          'acquired', COALESCE(ci.acquired, false),
          'deleted', COALESCE(ci.deleted, false)
        )) AS ingredients
      FROM unnest($1::INT[]) AS rid(recipe_id)
      JOIN recipes r ON r.id = rid.recipe_id
      JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      JOIN ingredients i ON i.id = ri.ingredient_id
      LEFT JOIN cart_ingredients ci 
        ON ci.user_id = $2 
        AND ci.recipe_id = r.id 
        AND ci.ingredient_id = ri.ingredient_id
      GROUP BY r.id, r.title
    `;


    const mergedQuery = `
    SELECT 
      ri.ingredient_id,
      i.name AS ingredient_name,
      SUM(
        CASE 
          WHEN ci.deleted THEN 0  -- Exclude deleted items
          ELSE COALESCE(ri.quantity, 0)
        END
      ) AS total_quantity,
      ri.unit,
      BOOL_AND(ci.deleted) AS deleted  -- TRUE only if ALL instances are deleted
    FROM unnest($1::INT[]) AS rid(recipe_id)
    JOIN recipes r ON r.id = rid.recipe_id
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN cart_ingredients ci 
      ON ci.user_id = $2 
      AND ci.recipe_id = r.id 
      AND ci.ingredient_id = ri.ingredient_id
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

// __________-------------Restore deleted Ingredient-------------__________
const restoreIngredient = async (req, res) => {
  try {
    // Validate and parse ingredient ID
    const ingredientId = parseInt(req.params.id, 10);
    if (isNaN(ingredientId)) {
      return res.status(400).json({ 
        message: 'Invalid ingredient ID - must be a numeric value' 
      });
    }

    // Validate and parse optional recipe ID
    let recipeId;
    if (req.query.recipeId) {
      recipeId = parseInt(req.query.recipeId, 10);
      if (isNaN(recipeId)) {
        return res.status(400).json({ 
          message: 'Invalid recipe ID - must be numeric' 
        });
      }
    }

    await pool.query('BEGIN');

    // Build conditional query
    let query = `
      UPDATE cart_ingredients
      SET deleted = false
      WHERE user_id = $1
        AND ingredient_id = $2
        AND deleted = true
    `;
    const params = [req.userId, ingredientId];

    if (recipeId) {
      query += ' AND recipe_id = $3';
      params.push(recipeId);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({
        message: 'No deletable ingredients found',
        details: {
          ingredientId,
          recipeId: recipeId || 'any',
          userId: req.userId
        }
      });
    }

    // Rebuild cart_new recipes array
    await pool.query(`
      UPDATE cart_new
      SET recipe_id = ARRAY(
        SELECT DISTINCT recipe_id
        FROM cart_ingredients
        WHERE user_id = $1
          AND deleted = false
      )
      WHERE user_id = $1
    `, [req.userId]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      restoredCount: result.rowCount,
      ingredientId,
      recipeId: recipeId || 'all'
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Restore error:', error);
    res.status(500).json({ 
      message: 'Restoration failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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