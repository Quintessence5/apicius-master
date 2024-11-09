const express = require('express');
const router = express.Router();
const { registerUser, loginUser, dashboard, forgotPassword, resetPassword } = require('../controllers/userController'); // Single import

// Registration route
router.post('/register', registerUser);

// Other routes
router.post('/login', loginUser);
router.get('/dashboard', dashboard);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
