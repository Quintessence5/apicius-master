const express = require('express');
const router = express.Router();
const { loginUser, registerUser, dashboard, forgotPassword, resetPassword } = require('../controllers/userController');

// User registration route
router.post('/register', registerUser);

// User login route
router.post('/login', loginUser);

// Dashboard route
router.get('/dashboard', dashboard);

// Forgot password route
router.post('/forgot-password', forgotPassword);

// Reset password route
router.post('/reset-password', resetPassword);

module.exports = router;
