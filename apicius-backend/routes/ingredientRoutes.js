const express = require('express');
const { getAllIngredients } = require('../controllers/ingredientController');
const router = express.Router();

router.get('/', getAllIngredients);

router.get('/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Database connection failed' });
    }
});

module.exports = router;
