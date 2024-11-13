const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Database configuration file path

// Route to fetch all countries
router.get('/countries', async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM country ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

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
