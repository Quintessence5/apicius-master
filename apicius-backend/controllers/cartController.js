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

    // Add recipe ingredients to cart_ingredients with base units
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
      // 1. Get user's cart
      const cartResult = await pool.query(
        'SELECT recipe_id FROM cart_new WHERE user_id = $1',
        [req.userId]
      );
  
      if (!cartResult.rows[0]?.recipe_id?.length) {
        return res.json({ grouped: [], merged: [] });
      }
      const recipeIds = cartResult.rows[0].recipe_id;
  
      // 2. Get grouped by recipe
      const groupedQuery = `
        SELECT 
          r.id AS recipe_id,
          r.title AS recipe_title,
          JSONB_AGG(JSONB_BUILD_OBJECT(
            'ingredient_id', ri.ingredient_id,
            'name', i.name,
            'quantity', ri.quantity,
            'unit', ri.unit
          )) AS ingredients
        FROM unnest($1::INT[]) AS rid(recipe_id)
        JOIN recipes r ON r.id = rid.recipe_id
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients i ON i.id = ri.ingredient_id
        GROUP BY r.id, r.title
      `;
  
      // 3. Get merged ingredients
      const mergedQuery = `
        SELECT 
          ri.ingredient_id,
          i.name AS ingredient_name,
          SUM(ri.quantity) AS total_quantity,
          ri.unit
        FROM unnest($1::INT[]) AS rid(recipe_id)
        JOIN recipes r ON r.id = rid.recipe_id
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients i ON i.id = ri.ingredient_id
        GROUP BY ri.ingredient_id, i.name, ri.unit
      `;
  
      const [grouped, merged] = await Promise.all([
        pool.query(groupedQuery, [recipeIds]),
        pool.query(mergedQuery, [recipeIds])
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

// __________-------------Remove Recipe-------------__________
const removeFromCart = async (req, res) => {
  try {
    const { recipeId } = req.body;
    
    // Remove from cart_new
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

// __________-------------Toggle Acquired Status-------------__________
const toggleAcquired = async (req, res) => {
  try {
    const { ingredientId, recipeId, acquired } = req.body;
    
    await pool.query(`
      UPDATE cart_ingredients
      SET acquired = $1
      WHERE user_id = $2 
        AND ingredient_id = $3 
        AND recipe_id = $4
    `, [acquired, req.userId, ingredientId, recipeId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Toggle acquired error:', error);
    res.status(500).json({ message: 'Error updating status' });
  }
};

module.exports = { addToCart, getCart, removeFromCart, toggleAcquired };