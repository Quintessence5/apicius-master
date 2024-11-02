const express = require('express');
const router = express.Router();
const { registerUser, loginUser, forgotPassword, resetPassword, googleLogin, dashboard } = require('../controllers/userController');
const verifyToken = require('../middleware/verifyToken'); // Middleware to verify token

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google-login', googleLogin);
router.get('/dashboard', verifyToken, dashboard); // Protected route for dashboard

module.exports = router;
