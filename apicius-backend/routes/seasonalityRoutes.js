const express = require('express');
const router = express.Router();
const seasonalityController = require('../controllers/seasonalityController');

// Seasonality routes
router.get('/today', seasonalityController.getSeasonalToday);
router.get('/calendar', seasonalityController.getSeasonalCalendar);
router.get('/manage', seasonalityController.getSeasonalManagement);
router.post('/manage', seasonalityController.createSeasonalEntry);
router.put('/manage/:id', seasonalityController.updateSeasonalEntry);
router.delete('/manage/:id', seasonalityController.deleteSeasonalEntry);

module.exports = router;