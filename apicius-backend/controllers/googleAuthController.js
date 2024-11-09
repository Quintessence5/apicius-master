const admin = require('firebase-admin');
const pool = require('../config/db'); 

exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    // Verify token from Google
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, uid } = decodedToken;
    const [firstName, lastName] = name ? name.split(' ') : ["", ""];

    // Check if user exists in the database
    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (!userResult.rows.length) {
      // Register new user if not found
      userResult = await pool.query(
        'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
        [email, uid]
      );

      // Insert into user_profile
      await pool.query(
        'INSERT INTO user_profile (user_id, first_name, last_name) VALUES ($1, $2, $3)',
        [userResult.rows[0].id, firstName, lastName]
      );
    }

    // Generate JWT token for session management
    const token = jwt.sign({ userId: userResult.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
};
