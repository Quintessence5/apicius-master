const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Helper function to check if a token is revoked
const checkIfTokenRevoked = async (token) => {
    const result = await pool.query('SELECT revoked FROM refresh_tokens WHERE token = $1', [token]);
    return result.rows.length > 0 && result.rows[0].revoked;
};

// Token Authentication Middleware
const authenticateToken = async (req, res, next) => {
    const token = req.cookies?.accessToken || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Token is missing' });
    }

    try {
        const isRevoked = await checkIfTokenRevoked(token);
        if (isRevoked) {
            return res.status(403).json({ message: 'Forbidden: Token has been revoked' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: 'Forbidden: Invalid token' });
            }
            req.userId = decoded.userId; // Attach user_id to the request object
            next();
        });
    } catch (error) {
        console.error('Error in token authentication:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = authenticateToken;
