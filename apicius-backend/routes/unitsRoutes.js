const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Adjust based on your db connection setup

// GET route to fetch all units
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM units');
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching units:", error);
        res.status(500).json({ error: "An error occurred while fetching units" });
    }
});

module.exports = router;
