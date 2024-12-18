const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate Access Token
const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Generate Refresh Token with Expiry
const generateRefreshToken = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        console.log(`Deleting old tokens for userId: ${userId}`);
        await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

        const refreshToken = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        console.log(`Inserting new refresh token for userId: ${userId}`);
        await client.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, refreshToken, expiresAt]
        );

        await client.query('COMMIT'); // Commit transaction
        return refreshToken;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in generateRefreshToken:', error.message);
        throw new Error('Could not generate refresh token');
    } finally {
        client.release();
    }
};


// Refresh Tokens
exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    console.log("Incoming refresh request. Refresh Token:", refreshToken);

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not provided' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = false AND expires_at > NOW()',
            [refreshToken]
        );

        if (result.rows.length === 0) {
            console.log("Refresh token invalid or expired:", refreshToken);
            return res.status(403).json({ message: 'Invalid or expired refresh token' });
        }

        const userId = result.rows[0].user_id;

        // Generate new tokens
        console.log("Refreshing tokens for user:", userId);
        const newAccessToken = generateAccessToken(userId);
        const newRefreshToken = await generateRefreshToken(userId);

        // Revoke old token
        await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

        // Set new refresh token in cookies
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        console.log('Tokens refreshed successfully for user:', userId);
        return res.status(200).json({ accessToken: newAccessToken });
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