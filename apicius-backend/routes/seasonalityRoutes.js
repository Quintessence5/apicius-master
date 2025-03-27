const express = require('express');
const router = express.Router();
const seasonalityController = require('../controllers/seasonalityController');

// Regions route
router.get('/regions', seasonalityController.getRegions);

// Today's seasonal
router.get('/today', seasonalityController.getSeasonalToday);

// Calendar
router.get('/calendar', seasonalityController.getSeasonalCalendar);

// Management routes
router.route('/manage')
  .get(seasonalityController.getSeasonalManagement)
  .post(seasonalityController.createSeasonalEntry);

router.route('/manage/:id')
  .put(seasonalityController.updateSeasonalEntry)
  .delete(seasonalityController.deleteSeasonalEntry);

module.exports = router;