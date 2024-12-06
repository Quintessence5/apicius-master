const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const serviceAccount = require('../config/apicius05-firebase-adminsdk-w5v1o-505d701e82.json'); // Update the path

// Generate Access Token
const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Generate Refresh Token with Expiry
const generateRefreshToken = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start a transaction

        // Remove previous tokens for the user
        await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

        // Generate a new refresh token
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Insert the new refresh token
        await client.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, refreshToken, expiresAt]
        );

        await client.query('COMMIT'); // Commit the transaction
        console.log('Generated and stored new refresh token:', refreshToken);
        return refreshToken;
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error('Error in generateRefreshToken:', error.message); // Add detailed logging
        throw new Error('Could not generate refresh token');
    } finally {
        client.release(); // Release the client
    }
};
// Configure Nodemailer with Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Google Sign-in Logic
exports.googleLogin = async (req, res) => {
    const { token } = req.body;
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid, email, name, picture } = decodedToken;

        const [firstName, lastName] = name ? name.split(' ') : ['', ''];
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (email) VALUES ($1) RETURNING id',
                [email]
            );
            userId = newUser.rows[0].id;

            await pool.query(
                'INSERT INTO user_profile (user_id, first_name, last_name, firebase_uid, photo_url) VALUES ($1, $2, $3, $4, $5)',
                [userId, firstName, lastName, uid, picture]
            );
        } else {
            userId = existingUser.rows[0].id;
        }

        const appToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Google login successful', token: appToken });
    } catch (error) {
        console.error('Google Login Error:', error);
        res.status(500).json({ message: 'Authentication failed' });
    }
};

// Register User
exports.registerUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userResult = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
            [email, hashedPassword]
        );
        const userId = userResult.rows[0].id;

        const accessToken = generateAccessToken(userId);
        const refreshToken = await generateRefreshToken(userId); // Await the token

        res.cookie('accessToken', accessToken, {
            httpOnly: false,  // Allow browser-side JavaScript to access the cookie
            secure: false,    // Set `true` only if using HTTPS in production
            maxAge: 5 * 60 * 1000,  // 5 minutes
            sameSite: 'Lax',  // Adjust as needed for cross-origin scenarios
        });        

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'lax',
        });

        res.status(201).json({
            message: 'User registered successfully',
            userId, // Include userId in the response
        });
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

        const accessToken = generateAccessToken(user.id);
        const refreshToken = await generateRefreshToken(user.id); // Await the token

        // Set tokens as secure cookies
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: false, // Set to `true` in production
            maxAge: 15 * 60 * 1000, // 15 minutes
            sameSite: 'lax',
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false, // Set to `true` in production
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'lax',
        });

        console.log('Set Refresh Token Cookie:', refreshToken);

        res.status(200).json({ message: 'Login successful' });
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

// Logout User
exports.logoutUser = async (req, res) => {
    try {
        console.log('Logout initiated. Cookies:', req.cookies);

        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            console.warn('No refresh token provided for logout.');
            return res.status(400).json({ message: 'Refresh token not provided' });
        }

        await pool.query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        console.log('Logout successful. Cookies cleared.');
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

//Register Form 
// Get all countries with details
exports.getCountries = async (req, res) => {
    try {
        // Select `iso` code, `name`, and `flag` from the `country` table
        const result = await pool.query('SELECT iso, name, flag FROM country');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Dashboard - display message to logged-in user
exports.dashboard = async (req, res) => {
    try {
        console.log('Received userId:', req.userId); // Log the received userId

        // Fetch user's profile from the user_profile table
        const result = await pool.query(
            'SELECT username FROM user_profile WHERE user_id = $1', 
            [req.userId]
        );
        console.log('Database query result:', result.rows); // Log the query result

        if (!result.rows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Extract the username
        const username = result.rows[0].username;

        // Respond with a personalized message
        res.status(200).json({ message: `Welcome back, ${username}!` });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Server error' });
    }
};