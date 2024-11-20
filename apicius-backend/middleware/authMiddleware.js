const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    console.log('Authorization Header:', req.headers['authorization']); // Log the header
    console.log('Received Headers:', req.headers); // Log all headers
    
    const authHeader = req.headers['authorization']; // Get Authorization header
    console.log('Authorization Header:', authHeader); // Log the specific Authorization header

    const token = authHeader && authHeader.split(' ')[1]; // Extract the token
    
    console.log('Extracted Token:', token); // Log the extracted token
    
    if (!token) {
        console.error('Token not provided in request');
        return res.status(401).json({ message: 'Unauthorized: Token is missing' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
        req.userId = decoded.userId; // Attach user_id to the request object
        console.log('Decoded userId:', req.userId); // Log the decoded userId
        next();
    });
};

module.exports = authenticateToken;