const pool = require('../config/db');

exports.getAllIngredients = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ingredients'); // Make sure table name is correct
        res.status(200).json(result.rows); // Send result as JSON response
    } catch (error) {
        console.error('Error retrieving ingredients:', error);
        res.status(500).json({ message: 'Failed to retrieve ingredients' });
    }
};
