const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Route to fetch unique languages
router.get('/languages', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT language FROM country ORDER BY language ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching languages:', error);
        res.status(500).json({ error: 'Failed to fetch languages' });
    }
});

module.exports = router;
