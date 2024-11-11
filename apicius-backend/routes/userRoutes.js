const express = require('express');
const router = express.Router();
const {registerUser, loginUser, dashboard, forgotPassword, resetPassword, googleLogin  // Add googleLogin to the import list
} = require('../controllers/userController'); // Import functions directly

// Registration route
router.post('/register', registerUser);

// Other routes
router.post('/login', loginUser);
router.get('/dashboard', dashboard);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google-login', googleLogin); // Reference googleLogin directly

module.exports = router;
