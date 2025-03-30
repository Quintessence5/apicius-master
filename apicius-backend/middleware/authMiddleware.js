const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const checkIfTokenRevoked = async (token) => {
    const result = await pool.query('SELECT revoked FROM refresh_tokens WHERE token = $1', [token]);
    return result.rows.length > 0 && result.rows[0].revoked;
};

// Token Authentication Middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    console.log('Received token:', token);

    if (!token) {
        console.log('Token is missing'); 
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

            // Optional: Check if the token is revoked
            const isRevoked = await checkIfTokenRevoked(token);
            if (isRevoked) {
                console.log('Token has been revoked'); 
                return res.status(403).json({ message: 'Token has been revoked' });
            }

            console.log('Token verified. User ID:', decoded.userId, 'Role:', decoded.role);
            req.userId = decoded.userId || decoded.userId;  
            req.userRole = decoded.role || decoded.role; 
            console.log('Token verified. User ID:', req.userId, 'Role:', req.userRole);
            next();
        });
    } catch (error) {
        console.error('Unexpected error in token authentication:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = authenticateToken;