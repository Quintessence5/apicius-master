const express = require('express');
const router = express.Router();
const {registerUser, loginUser, logoutUser, forgotPassword, resetPassword, googleLogin, } = require('../controllers/userController'); // Import functions directly
const { dashboard, getCountries, } = require('../controllers/userController');
const { refreshToken, sessionStatus, } = require('../controllers/tokenController');
const { getProfile, saveUserProfile, updateUserProfile, getControlTags, saveUserPreferences, getUserPreferences } = require('../controllers/profileController');
const authenticateToken = require('../middleware/authMiddleware');

// Registrations route
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post("/refresh-token", refreshToken);
router.post("/logout", logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google-login', googleLogin); // Reference googleLogin directly
router.get('/session-status', sessionStatus);

// User Profile
router.post('/user_profile', saveUserProfile, updateUserProfile);
router.get('/country/countries', getCountries);

// Other routes
router.get('/dashboard', authenticateToken, dashboard);

router.get('/profile', authenticateToken, getProfile);
router.put('/profile', updateUserProfile);
router.get('/tags', getControlTags);
router.get('/preferences', authenticateToken, getUserPreferences);
router.post('/preferences', authenticateToken, saveUserPreferences);
router.put('/preferences', authenticateToken, saveUserPreferences);

module.exports = router;