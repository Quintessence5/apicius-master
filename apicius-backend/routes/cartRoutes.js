const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authenticateToken = require('../middleware/authMiddleware');

router.post('/add', authenticateToken, cartController.addToCart);
router.get('/', authenticateToken, cartController.getCart);
router.post('/remove', authenticateToken, cartController.removeFromCart);
router.post('/clear', authenticateToken, cartController.clearCart);
router.patch('/acquired', authenticateToken, cartController.toggleAcquired);

module.exports = router;