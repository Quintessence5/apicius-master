const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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

// Generate Access Token
const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Generate Refresh Token with Expiry
const generateRefreshToken = async (userId) => {
    try {
        // Remove previous tokens for the user
        await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

        // Generate a new refresh token
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Attempt to insert the token into the database
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, refreshToken, expiresAt]
        );

        console.log('Generated and stored new refresh token:', refreshToken);
        return refreshToken;
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            console.error('Duplicate token error for userId:', userId);
            throw new Error('Duplicate refresh token detected. Please ensure database state is clean.');
        }
        console.error('Error generating refresh token:', error);
        throw new Error('Could not generate refresh token');
    }
};


// Refresh Tokens
exports.refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            console.error('Refresh token not provided');
            return res.status(401).json({ message: 'Refresh token not provided' });
        }

        const result = await pool.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = false AND expires_at > NOW()',
            [refreshToken]
        );

        if (result.rows.length === 0) {
            console.error('Invalid or expired refresh token:', refreshToken);
            return res.status(403).json({ message: 'Invalid or expired refresh token' });
        }

        const userId = result.rows[0].user_id;

        // Generate new tokens
        const newAccessToken = generateAccessToken(userId);
        const newRefreshToken = await generateRefreshToken(userId);

        // Revoke old token
        await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

        // Set cookies
        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        console.log('Tokens refreshed successfully for user:', userId);
        return res.status(200).json({ message: 'Token refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Check Session Status
exports.sessionStatus = async (req, res) => {
    try {
        const token = req.cookies?.accessToken;

        if (!token) {
            return res.status(401).json({ message: 'Access token missing' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Invalid or expired token' });
            }
            res.status(200).json({ message: 'Session active', userId: decoded.userId });
        });
    } catch (error) {
        console.error('Error checking session status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

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

// Profile Page
exports.getProfile = async (req, res) => {
    try {
        const userId = req.userId; // Assuming `verifyToken` middleware adds `userId`
        console.log('Fetching profile for userId:', userId);

        // Fetch data from both user_profile and users tables using a JOIN
        const query = `
            SELECT 
                up.username, 
                up.first_name, 
                up.last_name, 
                up.birthdate, 
                up.origin_country, 
                up.language,
                up.bio,
                u.email, 
                u.password 
            FROM user_profile AS up
            INNER JOIN users AS u ON up.user_id = u.id
            WHERE up.user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        // Log the query result
        console.log('Query result:', result.rows);

        // Check if any result was returned
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Extract user data
        const { 
            username, 
            first_name, 
            last_name, 
            birthdate, 
            origin_country, 
            language,
            bio, 
            email, 
            password,
            user_Id 
        } = result.rows[0];

        // Respond with user profile data
        res.status(200).json({
            username,
            first_name,
            last_name,
            birthdate,
            origin_country,
            language,
            bio,
            email,
            password,
            user_id: userId,
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Internal server error' });
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

exports.saveUserProfile = async (req, res) => {
    const { user_id, username, first_name, last_name, birthdate, origin_country, language, phone, newsletter, terms_condition, bio } = req.body;
    
    try {
        await pool.query(
            `INSERT INTO user_profile 
            (first_name, last_name, birthdate, user_id, firebase_uid, photo_url, username, origin_country, language, phone, newsletter, terms_condition, bio )
            VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8, $9, $10, $11)`,
            [first_name, last_name, birthdate, user_id, username, origin_country, language, phone || null, newsletter, terms_condition, bio ]
        );
        res.status(201).json({ message: 'Profile saved successfully' });
    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ message: 'Failed to save profile' });
    }
};

exports.updateUserProfile = async (req, res) => {
    const {
        user_id,
        username,
        first_name,
        last_name,
        birthdate,
        origin_country,
        language,
        phone,
        newsletter,
        email,
        newPassword,
        bio,
    } = req.body;

    console.log("Received Data:", req.body); // Log incoming payload

    // Ensure `user_id` is provided
    if (!user_id) {
        console.log("Missing user_id"); // Debug missing user_id
        return res.status(400).json({ message: "User ID is required" });
    }

    try {
        // 1. Update `user_profile` table
        const profileFieldsToUpdate = [];
        const profileValues = [];
        let profileIndex = 1;

        if (bio) {
            profileFieldsToUpdate.push(`bio = $${profileIndex++}`);
            profileValues.push(bio);
        }
        if (username) {
            profileFieldsToUpdate.push(`username = $${profileIndex++}`);
            profileValues.push(username);
        }
        if (first_name) {
            profileFieldsToUpdate.push(`first_name = $${profileIndex++}`);
            profileValues.push(first_name);
        }
        if (last_name) {
            profileFieldsToUpdate.push(`last_name = $${profileIndex++}`);
            profileValues.push(last_name);
        }
        if (birthdate) {
            profileFieldsToUpdate.push(`birthdate = $${profileIndex++}`);
            profileValues.push(birthdate);
        }
        if (origin_country) {
            profileFieldsToUpdate.push(`origin_country = $${profileIndex++}`);
            profileValues.push(origin_country);
        }
        if (language) {
            profileFieldsToUpdate.push(`language = $${profileIndex++}`);
            profileValues.push(language);
        }
        if (phone) {
            profileFieldsToUpdate.push(`phone = $${profileIndex++}`);
            profileValues.push(phone);
        }
        if (newsletter !== undefined) {
            profileFieldsToUpdate.push(`newsletter = $${profileIndex++}`);
            profileValues.push(newsletter);
        }

        if (profileFieldsToUpdate.length > 0) {
            profileValues.push(user_id);
            const profileQuery = `
                UPDATE user_profile
                SET ${profileFieldsToUpdate.join(", ")}
                WHERE user_id = $${profileIndex}
            `;
            console.log("Profile Update Query:", profileQuery);
            console.log("Profile Update Values:", profileValues);

            const profileResult = await pool.query(profileQuery, profileValues);
            console.log("Profile Update Result:", profileResult);
        }

        // 2. Update `users` table (email and password)
        const userFieldsToUpdate = [];
        const userValues = [];
        let userIndex = 1;

        if (email) {
            userFieldsToUpdate.push(`email = $${userIndex++}`);
            userValues.push(email);
        }

        if (newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            userFieldsToUpdate.push(`password = $${userIndex++}`);
            userValues.push(hashedPassword);
        }

        if (userFieldsToUpdate.length > 0) {
            userValues.push(user_id);
            const userQuery = `
                UPDATE users
                SET ${userFieldsToUpdate.join(", ")}
                WHERE id = $${userIndex}
            `;
            console.log("User Update Query:", userQuery);
            console.log("User Update Values:", userValues);

            const userResult = await pool.query(userQuery, userValues);
            console.log("User Update Result:", userResult);

            // Handle case where no user rows were updated
            if (userResult.rowCount === 0) {
                console.log("No changes made to users table");
                return res.status(404).json({ message: "User not found or no changes made" });
            }
        }

        // 3. Respond with success if any updates were made
        if (profileFieldsToUpdate.length > 0 || userFieldsToUpdate.length > 0) {
            return res.status(200).json({ message: "Profile updated successfully" });
        }

        console.log("No fields to update"); // Log no fields case
        res.status(400).json({ message: "No fields to update" });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
};
