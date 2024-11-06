const express = require('express');
const { getAllIngredients } = require('../controllers/ingredientController');
const pool = require('../config/db'); // Correctly import your DB connection
const router = express.Router();

// Route to get all ingredients
router.get('/', getAllIngredients);

// Test route to check database connection (you can remove this later)
router.get('/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Database connection failed' });
    }
});

module.exports = router;
