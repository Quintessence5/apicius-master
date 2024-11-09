const express = require('express');
const router = express.Router();
const { registerUser, loginUser, dashboard, forgotPassword, resetPassword } = require('../controllers/userController'); // Single import
const { googleLogin } = require('../controllers/userController');

// Registration route
router.post('/register', registerUser);

// Other routes
router.post('/login', loginUser);
router.get('/dashboard', dashboard);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google-login', userController.googleLogin);



module.exports = router;
