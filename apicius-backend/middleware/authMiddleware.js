const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Check if a token is revoked (for refresh tokens)
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
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    console.warn("Access token expired");
                    return res.status(401).json({ message: "Token expired, please refresh" });
                } else {
                    console.error("Token verification failed:", err.message);
                    return res.status(403).json({ message: "Invalid token" });
                }
            }

            // Optional: Check if the token is revoked (if access tokens can be revoked)
            const isRevoked = await checkIfTokenRevoked(token);
            if (isRevoked) {
                return res.status(403).json({ message: 'Token has been revoked' });
            }

            req.userId = decoded.userId; // Attach user ID to the request
            next();
        });
    } catch (error) {
        console.error('Unexpected error in token authentication:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = authenticateToken;
