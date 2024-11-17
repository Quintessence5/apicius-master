const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Adjust to the correct path for your database configuration

// Route to fetch all countries with iso, name, and flag
router.get('/countries', async (req, res) => {
    try {
        const result = await pool.query('SELECT iso, nicename AS name, flag FROM country ORDER BY nicename ASC');
        res.json(result.rows); // Returns iso, name, and flag
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

// Route to fetch unique languages (excluding entries with commas)
router.get('/languages', async (req, res) => {
    try {
        const result = await pool.query("SELECT DISTINCT language FROM country WHERE language NOT LIKE '%,%' ORDER BY language ASC");
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching languages:', error);
        res.status(500).json({ error: 'Failed to fetch languages' });
    }
});

// Route to fetch phone codes with Country & "+" prefix
router.get('/phonecodes', async (req, res) => {
    try {
        const result = await pool.query('SELECT nicename, phonecode FROM country WHERE phonecode IS NOT NULL ORDER BY nicename ASC');
        const formattedPhoneCodes = result.rows.map(row => `${row.nicename} +${row.phonecode}`);
        console.log('Phone codes fetched:', formattedPhoneCodes); // Debugging
        res.json(formattedPhoneCodes);
    } catch (error) {
        console.error('Error fetching phone codes:', error);
        res.status(500).json({ error: 'Failed to fetch phone codes' });
    }
});

router.get('/phonecodes', async (req, res) => {
    try {
        const result = await pool.query('SELECT nicename, phonecode FROM country WHERE phonecode IS NOT NULL ORDER BY nicename ASC');
        const formattedPhoneCodes = result.rows.map(row => `${row.nicename} +${row.phonecode}`);
        console.log('Phone codes fetched:', formattedPhoneCodes); // Debugging
        res.json(formattedPhoneCodes);
    } catch (error) {
        console.error('Error fetching phone codes:', error);
        res.status(500).json({ error: 'Failed to fetch phone codes' });
    }
});

module.exports = router;
