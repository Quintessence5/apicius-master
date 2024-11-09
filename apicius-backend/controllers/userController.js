const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const serviceAccount = require('../config/apicius05-firebase-adminsdk-w5v1o-505d701e82.json'); // Update the path


// Configure Nodemailer with Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Google Sign in
exports.googleLogin = async (req, res) => {
    const { token, email, firstName, lastName } = req.body;

    try {
        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid } = decodedToken;

        // Check if the user exists in the 'user' table
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        let userId;
        if (existingUser.rows.length === 0) {
            // Insert the new user in 'users' table
            const newUser = await pool.query(
                'INSERT INTO users (email) VALUES ($1) RETURNING id',
                [email]
            );
            userId = newUser.rows[0].id;

            // Insert additional profile data in 'user_profile'
            await pool.query(
                'INSERT INTO user_profile (user_id, first_name, last_name) VALUES ($1, $2, $3)',
                [userId, firstName, lastName]
            );
        } else {
            // If user exists, get their user_id
            userId = existingUser.rows[0].id;
        }

        // Generate a JWT token for your application
        const appToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Google login successful', token: appToken });
    } catch (error) {
        console.error('Google Login Error:', error);
        res.status(500).json({ message: 'Authentication failed' });
    }
};


// Register User
exports.registerUser = async (req, res) => {
    console.log("registerUser function called");  // Debugging line
    const { email, password, firstName, lastName, birthdate } = req.body;
    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Basic validation for input fields
    if (!email || !password || !firstName || !lastName || !birthdate) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
            [email, hashedPassword]
        );
        const userId = newUser.rows[0].id;
        await pool.query(
            'INSERT INTO user_profile (user_id, first_name, last_name, birthdate) VALUES ($1, $2, $3, $4)',
            [userId, firstName, lastName, birthdate]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Login User
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        await pool.query('UPDATE users SET reset_token = $1 WHERE id = $2', [resetToken, user.id]);

        const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: user.email,
            subject: 'Password Reset Request',
            text: `To reset your password, click the following link: ${resetLink}`,
        });

        res.status(200).json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error('Error sending password reset email:', error);
        res.status(500).json({ message: 'Failed to send reset email' });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Invalid or expired token' });
    }
};

// Dashboard - display message to logged-in user
exports.dashboard = async (req, res) => {
    try {
        res.status(200).json({ message: "Welcome to your dashboard!" });
    } catch (error) {
        console.error('Error accessing dashboard:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
