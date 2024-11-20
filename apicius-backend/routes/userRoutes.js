const express = require('express');
const router = express.Router();
const {getCountries, registerUser, loginUser, dashboard, forgotPassword, resetPassword, googleLogin, refreshToken, logoutUser,  
} = require('../controllers/userController'); // Import functions directly
const { saveUserProfile } = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware');

// Registrations route
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post("/refresh-token", refreshToken);
router.post("/logout", logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google-login', googleLogin); // Reference googleLogin directly

// User Profile
router.post('/user_profile', saveUserProfile);
router.get('/country/countries', getCountries);

// Other routes
router.get('/dashboard', authenticateToken, dashboard);


module.exports = router;