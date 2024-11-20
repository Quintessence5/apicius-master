const express = require('express');
const router = express.Router();
const {getCountries, registerUser, loginUser, dashboard, forgotPassword, resetPassword, googleLogin  // Add googleLogin to the import list
} = require('../controllers/userController'); // Import functions directly
const { saveUserProfile } = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware');

// Save User Profile
router.post('/user_profile', saveUserProfile);

// Registration route
router.post('/register', registerUser);

// Other routes
router.post('/login', loginUser);
router.get('/dashboard', authenticateToken, dashboard);
router.get('/country/countries', getCountries);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google-login', googleLogin); // Reference googleLogin directly

module.exports = router;
